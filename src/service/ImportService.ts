import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { Customer } from '../entities/Customer';
import { Order } from '../entities/Order';
import { Category } from '../entities/Category';
import { TaxRuleGroup } from '../entities/TaxRuleGroup';
import type { CsvStockRow } from './CSVImportService';
import { isCartOnlyOrderState, normalizeOrderEtat, orderStateTriggersStockMovement, resolveOrderStateId } from '../utils/orderState';
import { applyOrderStockMovements, applyStockDelta } from '../utils/stockMovement';

type CreatedByReference = Record<string, number>;

type StockImportResult = {
  success: number;
  failed: number;
  logs: string[];
};

export class ImportService {
  private taxRateByReference = new Map<string, number>();

  private getBaseUrl(): string {
    return import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api';
  }

  private normalizeReference(value: string): string {
    return value
      .replace(/^\.\_+/, '')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private xmlCdata(value: string): string {
    return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
  }

  private langTag(tagName: string, value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `<${tagName}><language id="1">${this.xmlCdata(trimmed)}</language></${tagName}>`;
  }

  private productOptionGroupXml(name: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option>
    <group_type>select</group_type>
    ${this.langTag('name', name)}
    ${this.langTag('public_name', name)}
  </product_option>
</prestashop>`;
  }

  private productOptionValueXml(groupId: number, name: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product_option_value>
    <id_attribute_group xlink:href="${this.getBaseUrl()}/product_options/${groupId}">${groupId}</id_attribute_group>
    ${this.langTag('name', name)}
  </product_option_value>
</prestashop>`;
  }

  private combinationXml(productId: number, price: number, reference: string, optionValueId: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product xlink:href="${this.getBaseUrl()}/products/${productId}">${productId}</id_product>
    <reference>${this.xmlEscape(reference)}</reference>
    <supplier_reference></supplier_reference>
    <location></location>
    <ean13></ean13>
    <isbn></isbn>
    <upc></upc>
    <wholesale_price>0.00</wholesale_price>
    <price>${Number.isFinite(price) ? price : 0}</price>
    <minimal_quantity>1</minimal_quantity>
    <ecotax>0</ecotax>
    <weight>0</weight>
    <unit_price_impact>0</unit_price_impact>
    <default_on>0</default_on>
    <available_date>0000-00-00</available_date>
    <associations>
      <product_option_values>
        <product_option_value>
          <id>${optionValueId}</id>
        </product_option_value>
      </product_option_values>
    </associations>
  </combination>
</prestashop>`;
  }

  private stockAvailableXml(productId: number, combinationId: number, quantity: number, shopId: number = 1): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id_product xlink:href="${this.getBaseUrl()}/products/${productId}">${productId}</id_product>
    <id_product_attribute xlink:href="${this.getBaseUrl()}/combinations/${combinationId}">${combinationId}</id_product_attribute>
    <id_shop xlink:href="${this.getBaseUrl()}/shops/${shopId}">${shopId}</id_shop>
    <quantity>${Math.trunc(quantity)}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>0</out_of_stock>
    <location></location>
  </stock_available>
</prestashop>`;
  }

  private async fetchXml(url: string, wsKey: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });
    return response.ok ? await response.text() : '';
  }

  private parseFirstId(xmlText: string, tagName?: string): number | undefined {
    const cleaned = xmlText.trim();
    if (!cleaned) return undefined;
    try {
      const doc = new DOMParser().parseFromString(cleaned, 'application/xml');

      // Si tagName est fourni, chercher d'abord dans ce tag (ex: <order><id>123</id>)
      if (tagName) {
        const targetNode = doc.querySelector(tagName);
        if (targetNode) {
          const idNode = targetNode.querySelector(':scope > id');
          if (idNode && idNode.textContent) {
            const parsed = parseInt(idNode.textContent.trim(), 10);
            if (!isNaN(parsed) && parsed > 0) return parsed;
          }
          // Essayer l'attribut id
          const idAttr = targetNode.getAttribute('id');
          if (idAttr && /^\d+$/.test(idAttr)) return Number(idAttr);
        }
      }

      // Chercher le premier <id> tag partout
      const idNode = doc.querySelector('id');
      if (idNode && idNode.textContent) {
        const parsed = parseInt(idNode.textContent.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore parser errors
    }

    // Fallback: regex search
    const match = cleaned.match(/\sid="(\d+)"/);
    if (match) return Number(match[1]);
    const idMatch = cleaned.match(/<id>(\d+)<\/id>/);
    return idMatch ? Number(idMatch[1]) : undefined;
  }

  private async postXml(url: string, wsKey: string, body: string): Promise<Response> {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
      body,
    });
  }

  private async putXml(url: string, wsKey: string, body: string): Promise<Response> {
    return fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
      body,
    });
  }

  private async ensureProductOptionGroupId(name: string, wsKey: string): Promise<number> {
    const trimmed = name.trim();
    const lookupUrl = `${this.getBaseUrl()}/product_options?display=[id]&filter[name]=[${encodeURIComponent(trimmed)}]`;
    const lookup = await fetch(lookupUrl, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') },
    });
    if (lookup.ok) {
      const xml = await lookup.text();
      const id = this.parseFirstId(xml, 'product_option');
      if (id) return id;
    }

    const create = await this.postXml(`${this.getBaseUrl()}/product_options`, wsKey, this.productOptionGroupXml(trimmed));
    const body = await create.text();
    if (!create.ok) {
      throw new Error(`Création du groupe d'attribut "${trimmed}" échouée: ${create.status} - ${this.extractPrestashopError(body)}`);
    }

    const id = this.parseFirstId(body, 'product_option');
    if (!id) throw new Error(`Création du groupe d'attribut "${trimmed}" réussie mais ID introuvable`);
    return id;
  }

  private async ensureProductOptionValueId(groupId: number, name: string, wsKey: string): Promise<number> {
    const trimmed = name.trim();
    const lookupUrl = `${this.getBaseUrl()}/product_option_values?display=[id]&filter[name]=[${encodeURIComponent(trimmed)}]&filter[id_attribute_group]=[${groupId}]`;
    const lookup = await fetch(lookupUrl, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') },
    });
    if (lookup.ok) {
      const xml = await lookup.text();
      const id = this.parseFirstId(xml, 'product_option_value');
      if (id) return id;
    }

    const create = await this.postXml(
      `${this.getBaseUrl()}/product_option_values`,
      wsKey,
      this.productOptionValueXml(groupId, trimmed)
    );
    const body = await create.text();
    if (!create.ok) {
      throw new Error(`Création de la valeur d'attribut "${trimmed}" échouée: ${create.status} - ${this.extractPrestashopError(body)}`);
    }

    const id = this.parseFirstId(body, 'product_option_value');
    if (!id) throw new Error(`Création de la valeur d'attribut "${trimmed}" réussie mais ID introuvable`);
    return id;
  }

  private async ensureCombinationId(productId: number, reference: string, price: number | undefined, optionValueId: number, wsKey: string): Promise<number> {
    const lookupUrl = `${this.getBaseUrl()}/combinations?display=full&filter[id_product]=[${productId}]`;
    const lookup = await fetch(lookupUrl, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') },
    });
    if (lookup.ok) {
      const xml = await lookup.text();
      const combinationIds = Array.from(xml.matchAll(/<combination[^>]*\sid="(\d+)"/g)).map((match) => Number(match[1]));
      for (const combinationId of combinationIds) {
        const comboXml = await this.fetchXml(`${this.getBaseUrl()}/combinations/${combinationId}`, wsKey);
        if (comboXml.includes(`<id>${optionValueId}</id>`)) {
          // Update price impact if provided (price is HT impact vs base product price)
          if (Number.isFinite(price ?? NaN)) {
            try {
              await this.putXml(
                `${this.getBaseUrl()}/combinations/${combinationId}`,
                wsKey,
                `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id>${combinationId}</id>
    <id_product>${productId}</id_product>
    <price>${Number(price).toFixed(6)}</price>
  </combination>
</prestashop>`
              );
            } catch {
              // Ignore update failures: keep existing combination
            }
          }
          return combinationId;
        }
      }
    }

    const create = await this.postXml(
      `${this.getBaseUrl()}/combinations`,
      wsKey,
      this.combinationXml(productId, price ?? 0, reference, optionValueId)
    );
    const body = await create.text();
    if (!create.ok) {
      throw new Error(`Création de la combinaison pour ${reference} échouée: ${create.status} - ${this.extractPrestashopError(body)}`);
    }

    const id = this.parseFirstId(body, 'combination');
    if (!id) throw new Error(`Combinaison pour ${reference} créée mais ID introuvable`);
    await this.ensureStockAvailable(productId, id, 0, wsKey);
    return id;
  }

  private async fetchStockQuantityFromApi(
    productId: number,
    combinationId: number,
    wsKey: string
  ): Promise<number> {
    const lookupUrl = `${this.getBaseUrl()}/stock_availables?display=full&filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]`;
    const lookup = await fetch(lookupUrl, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') },
    });
    if (!lookup.ok) return 0;

    const xml = await lookup.text();
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const qtyText = doc.getElementsByTagName('quantity')[0]?.textContent?.trim();
    const qty = Number(qtyText);
    return Number.isFinite(qty) ? qty : 0;
  }

  /** Met à jour le stock et enregistre un mouvement dans l'historique journalier. */
  private async setStockWithMovement(
    productId: number,
    combinationId: number,
    targetQuantity: number,
    wsKey: string,
    movementDate: string
  ): Promise<void> {
    const previous = await this.fetchStockQuantityFromApi(productId, combinationId, wsKey);
    const target = Math.max(0, Math.trunc(targetQuantity));
    const delta = target - previous;

    if (delta !== 0) {
      const ok = await applyStockDelta(productId, combinationId, delta, movementDate);
      if (ok) return;
    }

    await this.ensureStockAvailable(productId, combinationId, target, wsKey);
  }

  private async ensureStockAvailable(productId: number, combinationId: number, quantity: number, wsKey: string): Promise<void> {
    const lookupUrl = `${this.getBaseUrl()}/stock_availables?display=full&filter[id_product]=[${productId}]&filter[id_product_attribute]=[${combinationId}]`;
    const lookup = await fetch(lookupUrl, {
      headers: { Authorization: 'Basic ' + btoa(wsKey + ':') },
    });

    if (lookup.ok) {
      const xml = await lookup.text();
      const stockId = this.parseFirstId(xml, 'stock_available');
      if (stockId) {
        const update = await this.putXml(
          `${this.getBaseUrl()}/stock_availables/${stockId}`,
          wsKey,
          `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${stockId}</id>
    <id_product>${productId}</id_product>
    <id_product_attribute>${combinationId}</id_product_attribute>
    <quantity>${Math.trunc(quantity)}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>0</out_of_stock>
    <location></location>
  </stock_available>
</prestashop>`
        );
        if (update.ok) return;
        const updateBody = await update.text();
        throw new Error(`Mise à jour du stock produit ${productId} / combinaison ${combinationId} échouée: ${update.status} - ${this.extractPrestashopError(updateBody)}`);
      }
    }

    const create = await this.postXml(
      `${this.getBaseUrl()}/stock_availables`,
      wsKey,
      this.stockAvailableXml(productId, combinationId, quantity)
    );
    const body = await create.text();
    if (!create.ok) {
      throw new Error(`Création du stock produit ${productId} / combinaison ${combinationId} échouée: ${create.status} - ${this.extractPrestashopError(body)}`);
    }
  }

  private extractPrestashopError(xmlText: string): string {
    const cleaned = xmlText.trim();
    if (!cleaned) return 'Aucune réponse détaillée du serveur';

    try {
      const doc = new DOMParser().parseFromString(cleaned, 'application/xml');
      const messageNode = doc.querySelector('error > message') || doc.querySelector('message');
      const message = messageNode?.textContent?.trim();
      if (message) return message;
    } catch {
      // ignore
    }

    return cleaned.slice(0, 500);
  }

  private async extractIdFromCreateResponse(response: Response, responseText: string): Promise<number | undefined> {
    try {
      const doc = new DOMParser().parseFromString(responseText, 'application/xml');
      const idNode = doc.querySelector('prestashop > * > id');
      const idText = idNode?.textContent?.trim();
      if (idText && /^\d+$/.test(idText)) return Number(idText);
    } catch {
      // ignore
    }

    const loc = response.headers.get('location') || response.headers.get('Location');
    if (loc) {
      const m = loc.match(/\/(\d+)(?:\?.*)?$/);
      if (m) return Number(m[1]);
    }
    return undefined;
  }

  private toLinkRewrite(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async checkCategoryExists(id: number, wsKey: string): Promise<boolean> {
    const response = await fetch(`${this.getBaseUrl()}/categories?display=[id]&filter[id]=[${id}]`, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });
    if (!response.ok) return false;

    const text = await response.text();
    return /<category[^>]*\sid="\d+"/.test(text) || /<id>\d+<\/id>/.test(text);
  }

  private async findRootCategoryId(wsKey: string): Promise<number | undefined> {
    const url = `${this.getBaseUrl()}/categories?display=[id]&filter[id_parent]=[0]`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });
    if (!response.ok) return undefined;

    const text = await response.text();
    const m = text.match(/<category[^>]*\sid="(\d+)"/);
    if (m) return Number(m[1]);
    const idMatch = text.match(/<id>(\d+)<\/id>/);
    return idMatch ? Number(idMatch[1]) : undefined;
  }

  private async getCategoryParentId(wsKey: string): Promise<number> {
    if (await this.checkCategoryExists(2, wsKey)) {
      return 2;
    }
    if (await this.checkCategoryExists(1, wsKey)) {
      return 1;
    }
    const rootId = await this.findRootCategoryId(wsKey);
    return rootId ?? 1;
  }

  async ensureCategoryIdByName(name: string, wsKey: string): Promise<number> {
    const trimmed = name.trim();
    if (!trimmed) {
      return await this.getCategoryParentId(wsKey);
    }
    if (trimmed.toLowerCase() === 'home') {
      return await this.getCategoryParentId(wsKey);
    }

    const url = `${this.getBaseUrl()}/categories?display=[id]&filter[name]=[${encodeURIComponent(trimmed)}]`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (response.ok) {
      const text = await response.text();
      let m = text.match(/<category[^>]*\sid="(\d+)"/);
      if (!m) {
        m = text.match(/<id>(\d+)<\/id>/);
      }
      if (m) return Number(m[1]);
    }

    const parentId = await this.getCategoryParentId(wsKey);
    const parentHref = `${this.getBaseUrl()}/categories/${parentId}`;
    const category = new Category(0, {
      id_parent: parentId,
      id_parent_href: parentHref,
      name: trimmed,
      link_rewrite: this.toLinkRewrite(trimmed),
      active: true,
    });

    const requestBody = category.getCreateXML();
    const createResp = await fetch(`${this.getBaseUrl()}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
      body: requestBody,
    });

    const bodyText = await createResp.text();
    if (!createResp.ok) {
      const errorDetails = this.extractPrestashopError(bodyText);
      throw new Error(
        `Création catégorie "${trimmed}" échouée: ${createResp.status} - ${errorDetails}. Request body: ${requestBody.slice(0, 400).replace(/\s+/g, ' ')}...`
      );
    }

    const id = await this.extractIdFromCreateResponse(createResp, bodyText);
    if (!id) throw new Error(`Catégorie "${trimmed}": créé mais ID introuvable`);
    return id;
  }

  async ensureTaxRuleGroupIdByRate(rate: number, wsKey: string): Promise<number | undefined> {
    if (!Number.isFinite(rate) || rate <= 0) return undefined;

    // Keep a stable name so we can lookup by filter[name]
    const name = `TVA ${rate.toFixed(2)}%`;

    const url = `${this.getBaseUrl()}/tax_rule_groups?display=[id]&filter[name]=[${encodeURIComponent(name)}]`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (response.ok) {
      const text = await response.text();
      const m = text.match(/<tax_rule_group[^>]*\sid="(\d+)"/);
      if (m) return Number(m[1]);
    }

    // If the endpoint doesn't exist in this PS version/config, skip silently.
    if (response.status === 404) return undefined;

    const trg = new TaxRuleGroup(0, { name, active: true });
    const createResp = await fetch(`${this.getBaseUrl()}/tax_rule_groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
      body: trg.getCreateXML(),
    });

    const bodyText = await createResp.text();
    if (!createResp.ok) {
      // Not fatal for product creation; return undefined so we can proceed without tax group
      return undefined;
    }

    return this.extractIdFromCreateResponse(createResp, bodyText);
  }

  async findProductIdByReference(reference: string, wsKey: string): Promise<number | undefined> {
    const trimmed = reference.trim();
    if (!trimmed) return undefined;
    const normalized = this.normalizeReference(trimmed);

    const url = `${this.getBaseUrl()}/products?display=[id]&filter[reference]=[${encodeURIComponent(trimmed)}]`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (!response.ok) return undefined;
    const text = await response.text();
    const m = text.match(/<product[^>]*\sid="(\d+)"/);
    if (m) return Number(m[1]);

    const fallback = await fetch(`${this.getBaseUrl()}/products?display=[id,reference]&limit=1000`, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (!fallback.ok) return undefined;

    const fallbackText = await fallback.text();
    const productMatches = Array.from(fallbackText.matchAll(/<product[^>]*\sid="(\d+)"[\s\S]*?<reference>([^<]*)<\/reference>/g));
    for (const match of productMatches) {
      const candidateId = Number(match[1]);
      const candidateReference = match[2]?.trim();
      if (candidateReference === trimmed) {
        return candidateId;
      }
      if (this.normalizeReference(candidateReference || '') === normalized) {
        return candidateId;
      }
    }

    return undefined;
  }

  private async fetchProductPrice(productId: number, wsKey: string): Promise<number> {
    const url = `${this.getBaseUrl()}/products/${productId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (!response.ok) return 0;

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const priceText = doc.querySelector('product > price')?.textContent?.trim() || doc.querySelector('price')?.textContent?.trim() || '0';
    const price = Number.parseFloat(priceText);
    return Number.isFinite(price) ? price : 0;
  }

  private async fetchCombinationPrice(combinationId: number, wsKey: string): Promise<number> {
    const url = `${this.getBaseUrl()}/combinations/${combinationId}`;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + btoa(wsKey + ':'),
      },
    });

    if (!response.ok) return 0;

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const priceText = doc.querySelector('combination > price')?.textContent?.trim() || doc.querySelector('price')?.textContent?.trim() || '0';
    const price = Number.parseFloat(priceText);
    return Number.isFinite(price) ? price : 0;
  }

  async importProducts(products: Product[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/products`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(product.getWsKey() + ':'),
            },
            body: product.getCreateXML(),
          }
        );

        const responseText = await response.text();

        if (response.ok) {
          success++;
          logs.push(`Produit "${product.name}": créé (${response.status})`);
        } else {
          failed++;
          logs.push(
            `Produit "${product.name}": échoué (${response.status}) - ${this.extractPrestashopError(responseText)}`
          );
        }
      } catch (err) {
        failed++;
        logs.push(`Produit "${product.name}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  async importCatalogRows(
    rows: Array<{
      availableDate?: Date;
      name: string;
      reference: string;
      priceTtc: number;
      taxRate: number;
      categoryName: string;
      wholesalePrice?: number;
    }>
  ): Promise<{ success: number; failed: number; logs: string[]; createdByReference: CreatedByReference }> {
    const logs: string[] = [];
    const createdByReference: CreatedByReference = {};
    let success = 0;
    let failed = 0;

    this.taxRateByReference.clear();

    const wsKey = new Product().getWsKey();
    const categoryCache = new Map<string, number>();
    const taxGroupCache = new Map<string, number | undefined>();

    for (const row of rows) {
      const categoryKey = row.categoryName.trim().toLowerCase();
      let categoryId = categoryCache.get(categoryKey);
      if (!categoryId) {
        categoryId = await this.ensureCategoryIdByName(row.categoryName, wsKey);
        categoryCache.set(categoryKey, categoryId);
        logs.push(`Catégorie "${row.categoryName}": OK (id=${categoryId})`);
      }

      const taxKey = Number.isFinite(row.taxRate) ? row.taxRate.toFixed(4) : '0';
      let taxGroupId = taxGroupCache.get(taxKey);
      if (taxGroupId === undefined && row.taxRate > 0) {
        taxGroupId = await this.ensureTaxRuleGroupIdByRate(row.taxRate, wsKey);
        taxGroupCache.set(taxKey, taxGroupId);
        if (taxGroupId) logs.push(`Tax group ${row.taxRate}%: OK (id=${taxGroupId})`);
      }

      const priceHt = row.taxRate > 0 ? row.priceTtc / (1 + row.taxRate / 100) : row.priceTtc;

      const product = new Product({
        name: row.name,
        reference: row.reference,
        price: Number.isFinite(priceHt) ? Number(priceHt.toFixed(6)) : 0,
        wholesale_price: row.wholesalePrice,
        available_date: row.availableDate,
        active: true,
        id_category_default: categoryId,
        id_tax_rules_group: taxGroupId,
        associations: {
          categories: [{ link: '', value: categoryId }],
        },
      });

      try {
        const response = await fetch(`${this.getBaseUrl()}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            Authorization: 'Basic ' + btoa(product.getWsKey() + ':'),
          },
          body: product.getCreateXML(),
        });

        const responseText = await response.text();
        if (response.ok) {
          success++;
          const createdId = await this.extractIdFromCreateResponse(response, responseText);
          if (createdId) {
            createdByReference[row.reference] = createdId;
            createdByReference[this.normalizeReference(row.reference)] = createdId;
            await this.ensureStockAvailable(createdId, 0, 0, wsKey);
            logs.push(`Produit "${row.reference}": ligne stock créée (quantité=0)`);
          }
          this.taxRateByReference.set(row.reference.trim(), row.taxRate);
          this.taxRateByReference.set(this.normalizeReference(row.reference), row.taxRate);
          logs.push(`Produit "${row.reference}": créé (${response.status})${createdId ? ` id=${createdId}` : ''}`);
        } else {
          failed++;
          logs.push(
            `Produit "${row.reference}": échoué (${response.status}) - ${this.extractPrestashopError(responseText)}`
          );
        }
      } catch (err) {
        failed++;
        logs.push(`Produit "${row.reference}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (success > 0) {
      window.dispatchEvent(new Event('prestashop-stock-updated'));
    }

    return { success, failed, logs, createdByReference };
  }

  async importVariants(variants: ProductVariant[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const variant of variants) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/combinations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(variant.getWsKey() + ':'),
            },
            body: variant.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Variante "${variant.reference}" ${variant.karazany}: créée (${response.status})`);
        } else {
          failed++;
          logs.push(`Variante "${variant.reference}" ${variant.karazany}: échouée (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(
          `Variante "${variant.reference}": erreur - ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { success, failed, logs };
  }

  async importStockRows(rows: CsvStockRow[], createdByReference: CreatedByReference = {}): Promise<StockImportResult> {
    const logs: string[] = [];
    const wsKey = new Product().getWsKey();
    const optionGroupCache = new Map<string, number>();
    const optionValueCache = new Map<string, number>();
    let success = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const normalizedReference = this.normalizeReference(row.reference);
        const productId = createdByReference[row.reference] || createdByReference[normalizedReference] || await this.findProductIdByReference(row.reference, wsKey);
        if (!productId) {
          failed++;
          logs.push(`Stock "${row.reference}": produit introuvable`);
          continue;
        }

        const hasVariant = Boolean(row.specificite?.trim() && row.karazany?.trim());
        let combinationId = 0;

        if (hasVariant) {
          const groupName = row.specificite!.trim();
          const valueName = row.karazany!.trim();
          const groupKey = groupName.toLowerCase();
          const valueKey = `${groupKey}::${valueName.toLowerCase()}`;

          let groupId = optionGroupCache.get(groupKey);
          if (!groupId) {
            groupId = await this.ensureProductOptionGroupId(groupName, wsKey);
            optionGroupCache.set(groupKey, groupId);
          }

          let optionValueId = optionValueCache.get(valueKey);
          if (!optionValueId) {
            optionValueId = await this.ensureProductOptionValueId(groupId, valueName, wsKey);
            optionValueCache.set(valueKey, optionValueId);
          }

          // PrestaShop combination.price is an HT impact (delta) vs base product HT price.
          // Our CSV provides prix_vente_ttc (final TTC). Convert TTC -> HT and compute impact.
          let impactHt: number | undefined = undefined;
          if (Number.isFinite(row.prixVenteTtc ?? NaN)) {
            const taxRatePct = this.taxRateByReference.get(row.reference.trim()) ?? this.taxRateByReference.get(normalizedReference) ?? 20;
            const taxRate = Number.isFinite(taxRatePct) ? taxRatePct : 20;
            const basePriceHt = await this.fetchProductPrice(productId, wsKey);
            const finalPriceHt = taxRate > 0 ? (Number(row.prixVenteTtc) / (1 + taxRate / 100)) : Number(row.prixVenteTtc);
            impactHt = Number.parseFloat((finalPriceHt - basePriceHt).toFixed(6));
          }

          combinationId = await this.ensureCombinationId(productId, row.reference, impactHt, optionValueId, wsKey);
          await this.setStockWithMovement(
            productId,
            combinationId,
            row.stockInitial,
            wsKey,
            new Date().toISOString().slice(0, 10)
          );
          logs.push(
            `Stock "${row.reference}": combinaison ${groupName} = ${valueName}, quantité=${row.stockInitial}${combinationId ? `, combinationId=${combinationId}` : ''}`
          );
        } else {
          const existingCombinationId = 0;
          await this.setStockWithMovement(
            productId,
            existingCombinationId,
            row.stockInitial,
            wsKey,
            new Date().toISOString().slice(0, 10)
          );
          if (Number.isFinite(row.prixVenteTtc ?? NaN)) {
            const taxRatePct = this.taxRateByReference.get(row.reference.trim()) ?? this.taxRateByReference.get(normalizedReference) ?? 20;
            const taxRate = Number.isFinite(taxRatePct) ? taxRatePct : 20;
            const priceHt = taxRate > 0 ? (Number(row.prixVenteTtc) / (1 + taxRate / 100)) : Number(row.prixVenteTtc);
            const updateProduct = await this.putXml(
              `${this.getBaseUrl()}/products/${productId}`,
              wsKey,
              `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <product>
    <id>${productId}</id>
    <price>${Number.isFinite(priceHt) ? Number(priceHt).toFixed(6) : 0}</price>
  </product>
</prestashop>`
            );
            const updateBody = await updateProduct.text();
            if (!updateProduct.ok) {
              throw new Error(
                `Mise à jour du prix produit ${row.reference} échouée: ${updateProduct.status} - ${this.extractPrestashopError(updateBody)}`
              );
            }
          }
          logs.push(`Stock "${row.reference}": quantité=${row.stockInitial}`);
        }

        success++;
      } catch (err) {
        failed++;
        logs.push(`Stock "${row.reference}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (success > 0) {
      window.dispatchEvent(new Event('prestashop-stock-updated'))
    }

    return { success, failed, logs };
  }

  async importCustomers(customers: Customer[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/customers`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(customer.getWsKey() + ':'),
            },
            body: customer.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Client "${customer.firstname}": créé (${response.status})`);
        } else {
          failed++;
          logs.push(`Client "${customer.firstname}": échoué (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(`Client "${customer.firstname}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  async importOrders(orders: Order[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        const response = await fetch(
          `${this.getBaseUrl()}/orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(order.getWsKey() + ':'),
            },
            body: order.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Commande créée (${response.status})`);
        } else {
          failed++;
          const body = await response.text();
          logs.push(`Commande échouée (${response.status}): ${this.extractPrestashopError(body)}`);
        }
      } catch (err) {
        failed++;
        logs.push(`Commande: erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  async deleteProduct(productId: number, wsKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: 'Basic ' + btoa(wsKey + ':'),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Import des lignes de commande depuis le CSV.
   */
  async importOrderRows(rows: any[], createdByReference: CreatedByReference = {}): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;
    const wsKey = new Product().getWsKey();

    for (const row of rows) {
      try {
        // 1. Trouver ou créer le client
        let customerId = await this.findCustomerIdByEmail(row.email, wsKey);
        if (!customerId) {
          const names = (row.name || 'Client Inconnu').split(' ');
          const customer = new Customer(0, names[0] || 'Client', names[1] || 'Inconnu', row.email, row.pwd || 'password');
          const createResp = await this.postXml(`${this.getBaseUrl()}/customers`, wsKey, customer.getCreateXML());
          const createBody = await createResp.text();
          if (!createResp.ok) throw new Error(`Création client ${row.email} échouée: ${this.extractPrestashopError(createBody)}`);
          customerId = this.parseFirstId(createBody, 'customer');
          if (customerId) logs.push(`Client créé: ${row.email} (id=${customerId})`);
        } else {
          logs.push(`Client existant: ${row.email} (id=${customerId})`);
        }

        if (!customerId) throw new Error(`Impossible de récupérer l'ID client pour ${row.email}`);
        const customerSecureKey = await this.findCustomerSecureKey(customerId, wsKey);

        // 2. Trouver ou créer l'adresse
        let addressId = await this.findAddressIdByCustomer(customerId, wsKey);
        if (!addressId) {
          const names = (row.name || 'Client Inconnu').split(' ');
          const { Address } = await import('../entities/Address');
          const activeCountryId = await this.findActiveCountryId(wsKey);
          const address = new Address(0, {
            id_customer: customerId,
            id_country: activeCountryId,
            firstname: names[0] || 'Client',
            lastname: names[1] || 'Inconnu',
            address1: row.adresse || 'Rue Inconnue',
            city: 'Ville',
            postcode: '00000',
            alias: 'Import'
          });
          const createResp = await this.postXml(`${this.getBaseUrl()}/addresses`, wsKey, address.getCreateXML());
          const createBody = await createResp.text();
          if (!createResp.ok) throw new Error(`Création adresse échouée: ${this.extractPrestashopError(createBody)}`);
          addressId = this.parseFirstId(createBody, 'address');
          if (addressId) logs.push(`Adresse créée (id=${addressId})`);
        }

        if (!addressId) throw new Error(`Impossible de créer une adresse pour le client ${customerId}`);

        // 3. Parser les articles achetés
        // Format attendu: "[(T_01;3;ngoza)]" ou "[(T_01\t2\tkely)]"
        const items: any[] = [];
        const itemTotals: Array<{ lineTotalTaxExcl: number; lineTotal: number }> = [];
        const purchaseStr = row.achat || '';
        // Regex pour extraire (Ref;Qty;Variant) avec séparateur ';' OU tabulation
        const matches = Array.from(purchaseStr.matchAll(/\(([^;\t]+)[;\t]([^;\t]+)[;\t]([^)]*)\)/g)) as RegExpMatchArray[];

        for (const m of matches) {
          // Enlever les guillemets (simples et doubles) de tous les champs
          const ref = m[1].replace(/^\.\_+/, '').trim().replace(/["']/g, '');
          const qty = parseInt(m[2].trim().replace(/["']/g, ''), 10) || 1;
          const variant = m[3].trim().replace(/["']/g, '');
          const normalizedRef = this.normalizeReference(ref);

          // 1. Chercher par référence produit directe
          let productId = createdByReference[ref] || createdByReference[normalizedRef] || await this.findProductIdByReference(ref, wsKey);
          let productAttributeId = 0;

          if (productId && variant) {
            // 2. Si variante fournie, chercher la combinaison du produit qui match l'attribut
            productAttributeId = await this.findCombinationByProductAndAttributeValue(productId, variant, wsKey);
            if (productAttributeId > 0) {
              logs.push(`  Variante trouvée: produit=${ref}, attribut=${variant}, comboId=${productAttributeId}`);
            }
          } else if (!productId) {
            // 3. Fallback: chercher par référence de combinaison (si ref n'existe pas comme produit)
            const comboUrl = `${this.getBaseUrl()}/combinations?display=full&filter[reference]=[${encodeURIComponent(ref)}]`;
            const comboResp = await fetch(comboUrl, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
            if (comboResp.ok) {
              const comboXml = await comboResp.text();
              const comboDoc = new DOMParser().parseFromString(comboXml, 'application/xml');
              const comboNode = comboDoc.querySelector('combination');
              if (comboNode) {
                productAttributeId = Number(comboNode.querySelector('id')?.textContent || 0);
                productId = Number(comboNode.querySelector('id_product')?.textContent || 0);
              }
            }
          }

          if (productId) {
            const basePrice = await this.fetchProductPrice(productId, wsKey);
            const combinationPrice = productAttributeId > 0 ? await this.fetchCombinationPrice(productAttributeId, wsKey) : 0;
            const unitPrice = Number.parseFloat((basePrice + combinationPrice).toFixed(2));
            const taxRate = this.taxRateByReference.get(ref) ?? this.taxRateByReference.get(normalizedRef) ?? 0;
            const lineTotalTaxExcl = Number.parseFloat((unitPrice * qty).toFixed(2));
            const lineTotal = Number.parseFloat((lineTotalTaxExcl * (1 + taxRate / 100)).toFixed(2));
            logs.push(`  Article: ${ref} (product=${productId}, combo=${productAttributeId}) qty=${qty}, basePrice=${basePrice}, comboPrice=${combinationPrice}, unitPrice=${unitPrice}`);
            items.push({
              product_id: productId,
              product_attribute_id: productAttributeId,
              product_quantity: qty,
              product_price: unitPrice,
              product_name: ref,
              reference: ref
            });
            itemTotals.push({ lineTotalTaxExcl, lineTotal });
          }
        }

        if (items.length === 0) {
          logs.push(`  ⚠️ Aucun article reconnu dans "${purchaseStr}" pour ${row.email}`);
          continue;
        }

        const totalPaidTaxExcl = itemTotals.reduce((sum, item) => sum + item.lineTotalTaxExcl, 0);
        const totalPaid = itemTotals.reduce((sum, item) => sum + item.lineTotal, 0);
        logs.push(`  📊 Calcul total: items=${items.length}, totalExcl=${totalPaidTaxExcl}, totalIncl=${totalPaid}`);

        // 4. Créer le panier (Cart) d'abord
        const { Cart } = await import('../entities/Cart');
        const cart = new Cart();
        cart.id_customer = customerId;
        cart.id_address_delivery = addressId;
        cart.id_address_invoice = addressId;
        cart.id_currency = 1;
        cart.id_lang = 1;
        cart.id_carrier = 1;
        cart.products = items.map(item => ({
          id: item.product_id,
          id_product_attribute: item.product_attribute_id,
          quantity: item.product_quantity
        }));

        const cartCreateResp = await this.postXml(`${this.getBaseUrl()}/carts`, wsKey, cart.getCreateXML());
        const cartBody = await cartCreateResp.text();
        if (!cartCreateResp.ok) {
          throw new Error(`Création du panier échouée: ${this.extractPrestashopError(cartBody)}`);
        }
        const cartId = this.parseFirstId(cartBody, 'cart');
        if (!cartId) throw new Error("Le panier a été créé mais impossible de récupérer son ID");

        // État vide, "null", "dans le panier" → panier uniquement (pas de commande).
        if (isCartOnlyOrderState(row.etat)) {
          success++
          logs.push(`✓ Panier ${cartId} créé pour ${row.email} (sans commande, état="${normalizeOrderEtat(row.etat) || 'dans le panier'}")`)
          continue
        }

        // 5. Créer la commande
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day} 00:00:00`;
        const orderCreationState = normalizeOrderEtat(row.etat) || 'Payé'

        const order = new Order(
          0,
          customerId,
          row.email,
          row.name,
          formattedDate,
          orderCreationState,
          items,
          totalPaid,
          1, // carrier id
          addressId,
          addressId,
          cartId, // cart id validé
          'ps_cashondelivery',
          totalPaidTaxExcl,
          customerSecureKey || ''
        );

        const orderXml = order.getCreateXML();
        logs.push(`-- ORDERS REQUEST (truncated 1000 chars): ${orderXml.slice(0, 1000).replace(/\s+/g, ' ')}`);
        const orderCreateResp = await this.postXml(`${this.getBaseUrl()}/orders`, wsKey, orderXml);
        const orderRespText = await orderCreateResp.text();
        logs.push(`-- ORDERS RESPONSE: status=${orderCreateResp.status} ${orderCreateResp.statusText} length=${orderRespText.length}`);
        logs.push(`-- ORDERS RESPONSE BODY (full): ${orderRespText.slice(0, 2000)}`);
        if (orderCreateResp.ok) {
          success++;
          const orderId = this.parseFirstId(orderRespText, 'order');
          logs.push(`✓ Commande ${orderId} créée pour ${row.email}`);

          if (orderId) {
            try {
              // Mettre à jour l'ID sur l'objet commande pour générer le XML de mise à jour avec <id>
              order.id = orderId;
              const orderUpdateXml = order.getCreateXML();
              const orderUpdateResp = await this.putXml(`${this.getBaseUrl()}/orders/${orderId}`, wsKey, orderUpdateXml);
              if (orderUpdateResp.ok) {
                logs.push(`  ✓ Date de commande mise à jour avec succès : ${formattedDate}`);
              } else {
                const errText = await orderUpdateResp.text();
                logs.push(`  ⚠️ Impossible de mettre à jour la date de la commande : ${this.extractPrestashopError(errText)}`);
              }
            } catch (err) {
              logs.push(`  ⚠️ Erreur lors de la mise à jour de la date : ${err instanceof Error ? err.message : String(err)}`);
            }

            const id_order_state = resolveOrderStateId(row.etat)

            try {
              const prestaBase = (import.meta.env.VITE_PRESTASHOP_BASE_URL || '/prestashop').replace(/\/$/, '')
              const stateResp = await fetch(
                `${prestaBase}/bridge/update_order_state.php?id_order=${orderId}&id_order_state=${id_order_state}`,
                { method: 'POST' }
              );
              const stateData = await stateResp.json().catch(() => ({}));
              if (stateResp.ok && stateData.success) {
                logs.push(`  ✓ État de la commande mis à jour (id_order_state=${stateData.new_state ?? id_order_state})`);
              } else {
                logs.push(`  ⚠️ Impossible de mettre à jour l'état : ${stateData.message || stateResp.status}`);
              }

              if (
                orderStateTriggersStockMovement(id_order_state, row.etat) &&
                !stateData.prestashop_stock_handled
              ) {
                await applyOrderStockMovements(items, formattedDate);
                logs.push(`  ✓ Mouvement de stock enregistré (commande payée ou livrée)`);
                window.dispatchEvent(new Event('prestashop-stock-updated'));
              } else if (orderStateTriggersStockMovement(id_order_state, row.etat)) {
                logs.push(`  ✓ Stock géré par PrestaShop lors du changement d'état`);
                window.dispatchEvent(new Event('prestashop-stock-updated'));
              }
            } catch (err) {
              logs.push(`  ⚠️ Erreur lors de la mise à jour de l'état : ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else {
          failed++;
          const details = this.extractPrestashopError(orderRespText) || orderRespText.slice(0, 1000);
          logs.push(`✗ Échec commande pour ${row.email}: ${details}`);
        }

      } catch (err) {
        failed++;
        logs.push(`✗ Erreur ligne ${row.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  private async findCustomerIdByEmail(email: string, wsKey: string): Promise<number | undefined> {
    const url = `${this.getBaseUrl()}/customers?display=[id]&filter[email]=[${encodeURIComponent(email.trim())}]`;
    const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
    if (!response.ok) return undefined;
    return this.parseFirstId(await response.text(), 'customer');
  }

  private async findAddressIdByCustomer(customerId: number, wsKey: string): Promise<number | undefined> {
    const url = `${this.getBaseUrl()}/addresses?display=[id]&filter[id_customer]=[${customerId}]`;
    const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
    if (!response.ok) return undefined;
    return this.parseFirstId(await response.text(), 'address');
  }

  private async findCustomerSecureKey(customerId: number, wsKey: string): Promise<string | undefined> {
    const url = `${this.getBaseUrl()}/customers/${customerId}?display=[secure_key]`;
    const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
    if (!response.ok) return undefined;

    const text = await response.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const key = doc.querySelector('customer > secure_key')?.textContent?.trim()
      || doc.querySelector('secure_key')?.textContent?.trim()
      || '';

    return key || undefined;
  }

  private async findActiveCountryId(wsKey: string): Promise<number> {
    try {
      const url = `${this.getBaseUrl()}/countries?display=[id,active]&filter[active]=1&limit=1`;
      const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
      if (!response.ok) return 1; // fallback

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const countryId = doc.querySelector('country')?.querySelector('id')?.textContent;

      if (countryId && /^\d+$/.test(countryId)) {
        return Number(countryId);
      }
    } catch (err) {
      console.warn('[findActiveCountryId] Error:', err);
    }
    return 1; // fallback to country 1
  }

  private async findCombinationByProductAndAttributeValue(productId: number, attributeValue: string, wsKey: string): Promise<number> {
    try {
      // Récupérer toutes les combinaisons du produit
      const url = `${this.getBaseUrl()}/combinations?display=full&filter[id_product]=[${productId}]&limit=100`;
      const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
      if (!response.ok) return 0;

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const combinations = doc.querySelectorAll('combination');

      // Pour chaque combinaison, vérifier si elle a l'attribut value demandé
      for (const combo of combinations) {
        const associations = combo.querySelector('associations');
        if (!associations) continue;

        const attrValues = associations.querySelectorAll('product_option_values > product_option_value');
        for (const attrEl of attrValues) {
          const attrId = attrEl.querySelector('id')?.textContent?.trim() || '';

          // Chercher la product_option_value par ID pour obtenir son nom
          const attrName = await this.findAttributeValueName(parseInt(attrId), wsKey);
          if (attrName && attrName.toLowerCase() === attributeValue.toLowerCase()) {
            const comboId = combo.querySelector(':scope > id')?.textContent?.trim();
            if (comboId && /^\d+$/.test(comboId)) {
              return Number(comboId);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[findCombinationByProductAndAttributeValue] Error for product ${productId}, attr ${attributeValue}:`, err);
    }
    return 0;
  }

  private async findAttributeValueName(attrValueId: number, wsKey: string): Promise<string | undefined> {
    try {
      const url = `${this.getBaseUrl()}/product_option_values/${attrValueId}`;
      const response = await fetch(url, { headers: { Authorization: 'Basic ' + btoa(wsKey + ':') } });
      if (!response.ok) return undefined;

      const text = await response.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const name = doc.querySelector('product_option_value > name > language')?.textContent?.trim();
      return name;
    } catch (err) {
      console.warn(`[findAttributeValueName] Error for attr value ${attrValueId}:`, err);
    }
    return undefined;
  }

}
