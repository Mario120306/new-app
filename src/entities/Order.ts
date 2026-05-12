import { Mere } from './Mere';

export interface OrderItem {
  reference: string;
  quantity: number;
  variant: string;
}

export class Order extends Mere {
  id: number;
  id_customer: number;
  customer_email: string;
  customer_name: string;
  date_add: string;
  state: string; // en attente paiement à la livraison, paiement accepté, erreur de paiement
  items: OrderItem[];
  total_paid: number;

  constructor(
    id: number = 0,
    id_customer: number = 0,
    customer_email: string = '',
    customer_name: string = '',
    date_add: string = new Date().toISOString(),
    state: string = 'en attente',
    items: OrderItem[] = [],
    total_paid: number = 0
  ) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'orders', 'order');
    this.id = id;
    this.id_customer = id_customer;
    this.customer_email = customer_email;
    this.customer_name = customer_name;
    this.date_add = date_add;
    this.state = state;
    this.items = items;
    this.total_paid = total_paid;
  }

  getResourcePlural(): string {
    return 'orders';
  }

  getResourceSingular(): string {
    return 'order';
  }

  getCreateXML(): string {
    // Determine id_order_state based on state text
    let id_order_state = 1; // Default pending
    if (this.state.includes('paiement accepté')) id_order_state = 2; // Payment accepted
    if (this.state.includes('erreur de paiement')) id_order_state = 8; // Payment error

    let orderDetails = '';
    for (const item of this.items) {
      orderDetails += `
      <order_row>
        <product>${item.reference}</product>
        <product_quantity>${item.quantity}</product_quantity>
        <product_variant>${item.variant}</product_variant>
      </order_row>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <order>
    <id_address_delivery></id_address_delivery>
    <id_address_invoice></id_address_invoice>
    <id_cart></id_cart>
    <id_currency>1</id_currency>
    <id_lang>1</id_lang>
    <id_customer>${this.id_customer}</id_customer>
    <id_order_state>${id_order_state}</id_order_state>
    <id_shop>1</id_shop>
    <secure_key></secure_key>
    <payment>${this.state}</payment>
    <conversion_rate>1.0000000000</conversion_rate>
    <module>prestashop</module>
    <recyclable>0</recyclable>
    <gift>0</gift>
    <gift_message></gift_message>
    <mobile_theme>0</mobile_theme>
    <shipping_number></shipping_number>
    <cart_rule_used></cart_rule_used>
    <total_discounts>0.00</total_discounts>
    <total_discounts_tax_incl>0.00</total_discounts_tax_incl>
    <total_discounts_tax_excl>0.00</total_discounts_tax_excl>
    <total_paid>${this.total_paid}</total_paid>
    <total_paid_tax_incl>${this.total_paid}</total_paid_tax_incl>
    <total_paid_tax_excl>${this.total_paid}</total_paid_tax_excl>
    <total_products>${this.total_paid}</total_products>
    <total_products_wt>${this.total_paid}</total_products_wt>
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
    <date_upd>2026-05-12 00:00:00</date_upd>
    <note></note>
    <associations>
      <order_rows>${orderDetails}
      </order_rows>
    </associations>
  </order>
</prestashop>`;
  }
}
