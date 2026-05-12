import { Mere } from './Mere';

export class ProductVariant extends Mere {
  id: number;
  id_product: number;
  reference: string;
  specificite: string; // taille, couleur, etc.
  karazany: string; // ngoza, kely, mainty, fotsy, etc.
  stock_initial: number;
  prix_vente_ttc: number;

  constructor(
    id: number = 0,
    id_product: number = 0,
    reference: string = '',
    specificite: string = '',
    karazany: string = '',
    stock_initial: number = 0,
    prix_vente_ttc: number = 0
  ) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'combinations', 'combination');
    this.id = id;
    this.id_product = id_product;
    this.reference = reference;
    this.specificite = specificite;
    this.karazany = karazany;
    this.stock_initial = stock_initial;
    this.prix_vente_ttc = prix_vente_ttc;
  }

  getResourcePlural(): string {
    return 'combinations';
  }

  getResourceSingular(): string {
    return 'combination';
  }

  getCreateXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <combination>
    <id_product>${this.id_product}</id_product>
    <reference>${this.reference}</reference>
    <supplier_reference></supplier_reference>
    <location></location>
    <ean13></ean13>
    <isbn></isbn>
    <upc></upc>
    <wholesale_price>0.00</wholesale_price>
    <price>${this.prix_vente_ttc}</price>
    <ecotax>0</ecotax>
    <weight>0</weight>
    <unit_price_impact>0</unit_price_impact>
    <default_on>${this.id === 1 ? '1' : '0'}</default_on>
    <available_date>2026-05-12</available_date>
    <associations>
      <attribute_combinations>
        <attribute_combination>
          <id_attribute></id_attribute>
          <id_attribute_value></id_attribute_value>
        </attribute_combination>
      </attribute_combinations>
      <images></images>
    </associations>
  </combination>
</prestashop>`;
  }
}
