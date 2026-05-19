import { Mere } from './Mere';

export interface CartProduct {
  id: number;
  id_product_attribute?: number;
  quantity: number;
}

export class Cart extends Mere {
  id: number;
  id_customer?: number;
  id_address_delivery?: number;
  id_address_invoice?: number;
  id_currency?: number;
  id_lang?: number;
  id_carrier?: number;
  date_add?: string;
  products?: CartProduct[];

  constructor(id: number = 0, id_customer?: number, date_add?: string) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'carts', 'cart');
    this.id = id;
    this.id_customer = id_customer;
    this.date_add = date_add;
  }

  getResourcePlural(): string {
    return 'carts';
  }

  getResourceSingular(): string {
    return 'cart';
  }

  getCreateXML(): string {
    let cartRows = ''
    if (this.products && this.products.length > 0) {
      for (const p of this.products) {
        cartRows += `
        <cart_row>
          <id_product>${p.id}</id_product>
          <id_product_attribute>${p.id_product_attribute || 0}</id_product_attribute>
          <id_address_delivery>${this.id_address_delivery || 0}</id_address_delivery>
          <quantity>${p.quantity}</quantity>
        </cart_row>`
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <cart>
    <id_customer>${this.id_customer || ''}</id_customer>
    <id_address_delivery>${this.id_address_delivery || 0}</id_address_delivery>
    <id_address_invoice>${this.id_address_invoice || 0}</id_address_invoice>
    <id_currency>${this.id_currency || 1}</id_currency>
    <id_lang>${this.id_lang || 1}</id_lang>
    <id_carrier>${this.id_carrier || 0}</id_carrier>
    <associations>
      <cart_rows>${cartRows}
      </cart_rows>
    </associations>
  </cart>
</prestashop>`
  }
}
