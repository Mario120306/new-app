import { Mere } from './Mere';

export interface OrderItem {
  product_id: number;
  product_attribute_id: number;
  product_quantity: number;
  product_price: number;
  product_name: string;
  reference: string;
}

export class Order extends Mere {
  id: number;
  id_customer: number;
  customer_email: string;
  customer_name: string;
  date_add: string;
  state: string; // en attente paiement à la livraison, paiement accepté, erreur de paiement
  state_id?: number; // id_order_state PrestaShop (ex: 2 = paiement accepté/effectué)
  items: OrderItem[];
  total_paid: number;
  total_paid_tax_excl: number;
  id_carrier: number;
  id_address_delivery: number;
  id_address_invoice: number;
  id_cart: number;
  module: string;
  secure_key: string;

  constructor(
    id: number = 0,
    id_customer: number = 0,
    customer_email: string = '',
    customer_name: string = '',
    date_add: string = new Date().toISOString().slice(0, 19).replace('T', ' '),
    state: string = 'en attente',
    items: OrderItem[] = [],
    total_paid: number = 0,
    id_carrier: number = 0,
    id_address_delivery: number = 0,
    id_address_invoice: number = 0,
    id_cart: number = 0,
    module: string = '',
    total_paid_tax_excl: number = 0,
    secure_key: string = ''
  ) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'orders', 'order');
    this.id = id;
    this.id_customer = id_customer;
    this.customer_email = customer_email;
    this.customer_name = customer_name;
    this.date_add = date_add;
    this.state = state;
    this.items = items;
    this.total_paid = total_paid;
    this.total_paid_tax_excl = total_paid_tax_excl || total_paid;
    this.id_carrier = id_carrier;
    this.id_address_delivery = id_address_delivery;
    this.id_address_invoice = id_address_invoice;
    this.id_cart = id_cart;
    this.module = module || '';
    this.secure_key = secure_key;
  }

  getResourcePlural(): string {
    return 'orders';
  }

  getResourceSingular(): string {
    return 'order';
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  getCreateXML(): string {
    // Determine id_order_state based on state text
    // États utilisés : 1 = Dans le panier, 2 = Paiement effectué, 5 = Livré, 6 = Annulé
    let id_order_state = 1; // Default: Dans le panier
    const stateLC = this.state
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (stateLC.includes('livr')) {
      id_order_state = 5; // Livré
    } else if (stateLC.includes('paiement effectue') || stateLC.includes('paiement accepte') || stateLC.includes('pay')) {
      id_order_state = 2; // Paiement effectué
    } else if (stateLC.includes('erreur')) {
      id_order_state = 8; // Erreur de paiement
    } else if (stateLC.includes('annul')) {
      id_order_state = 6; // Annulé
    }

    let orderDetails = '';
    for (const item of this.items) {
      const productName = this.xmlEscape(item.product_name)
      const productReference = this.xmlEscape(item.reference)
      orderDetails += `
      <order_row>
        <product_id>${item.product_id}</product_id>
        <product_attribute_id>${item.product_attribute_id}</product_attribute_id>
        <product_quantity>${item.product_quantity}</product_quantity>
        <product_price>${item.product_price.toFixed(6)}</product_price>
        <product_name>${productName}</product_name>
        <product_reference>${productReference}</product_reference>
      </order_row>`;
    }

    // Si total_paid_tax_excl n'est pas fourni (ou vaut le même prix que TTC), on estime l'HT
    // Ici on utilise 1.2 comme diviseur par défaut pour retrouver l'HT si tax_excl == tax_incl
    let taxExcl = this.total_paid_tax_excl;
    if (taxExcl === this.total_paid && this.total_paid > 0) {
      taxExcl = parseFloat((this.total_paid / 1.2).toFixed(2));
    }

    const paymentValue = this.xmlEscape('Paiement à la livraison')
    const moduleValue = this.xmlEscape(this.module || 'ps_cashondelivery')
    const secureKeyValue = this.xmlEscape(this.secure_key || '')

    return `<?xml version="1.0" encoding="UTF-8"?>
    <prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
      <order>
        ${this.id ? `<id>${this.id}</id>` : ''}
        <id_address_delivery>${this.id_address_delivery}</id_address_delivery>
        <id_address_invoice>${this.id_address_invoice}</id_address_invoice>
        <id_cart>${this.id_cart}</id_cart>
        <id_carrier>${this.id_carrier}</id_carrier>
        <id_currency>1</id_currency>
        <id_lang>1</id_lang>
        <id_customer>${this.id_customer}</id_customer>
        <id_order_state>${id_order_state}</id_order_state>
        <id_shop>1</id_shop>
        <secure_key>${secureKeyValue}</secure_key>
        <payment>${paymentValue}</payment>
        <conversion_rate>1.0000000000</conversion_rate>
        <module>${moduleValue}</module>
        <recyclable>0</recyclable>
        <gift>0</gift>
        <gift_message></gift_message>
        <mobile_theme>0</mobile_theme>
        <shipping_number></shipping_number>
        <cart_rule_used></cart_rule_used>
        <total_discounts>0.00</total_discounts>
        <total_discounts_tax_incl>0.00</total_discounts_tax_incl>
        <total_discounts_tax_excl>0.00</total_discounts_tax_excl>
        <total_paid>${this.total_paid.toFixed(2)}</total_paid>
        <total_paid_real>${this.total_paid.toFixed(2)}</total_paid_real>
        <total_paid_tax_incl>${this.total_paid.toFixed(2)}</total_paid_tax_incl>
        <total_paid_tax_excl>${taxExcl.toFixed(2)}</total_paid_tax_excl>
        <total_products>${taxExcl.toFixed(2)}</total_products>
        <total_products_wt>${this.total_paid.toFixed(2)}</total_products_wt>
        <total_shipping>0.00</total_shipping>
        <total_shipping_tax_incl>0.00</total_shipping_tax_incl>
        <total_shipping_tax_excl>0.00</total_shipping_tax_excl>
        <carrier_tax_rate>0.0000000000</carrier_tax_rate>
        <total_wrapping>0.00</total_wrapping>
        <total_wrapping_tax_incl>0.00</total_wrapping_tax_incl>
        <total_wrapping_tax_excl>0.00</total_wrapping_tax_excl>
        <round_mode>2</round_mode>
        <round_type>2</round_type>
        <invoice_number>0</invoice_number>
        <delivery_number>0</delivery_number>
        <invoice_date></invoice_date>
        <delivery_date></delivery_date>
        <valid>0</valid>
        <date_add>${this.date_add}</date_add>
        <date_upd>${new Date().toISOString().slice(0, 19).replace('T', ' ')}</date_upd>
        <note></note>
        <associations>
          <order_rows>${orderDetails}
          </order_rows>
        </associations>
      </order>
    </prestashop>`;
  }

}
