import { Mere } from './Mere'

export class StockAvailable extends Mere {
  id: number = 0
  id_product: number = 0
  id_product_attribute: number = 0
  quantity: number = 0

  constructor(id: number = 0, id_product: number = 0, id_product_attribute: number = 0, quantity: number = 0) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'stock_availables', 'stock_available')
    this.id = id
    this.id_product = id_product
    this.id_product_attribute = id_product_attribute
    this.quantity = quantity
  }

  getResourcePlural(): string { return 'stock_availables' }
  getResourceSingular(): string { return 'stock_available' }

  getUpdateXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id>${this.id}</id>
    <id_product>${this.id_product}</id_product>
    <id_product_attribute>${this.id_product_attribute}</id_product_attribute>
    <quantity>${this.quantity}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>0</out_of_stock>
  </stock_available>
</prestashop>`;
  }

  getCreateXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id_product>${this.id_product}</id_product>
    <id_product_attribute>${this.id_product_attribute}</id_product_attribute>
    <id_shop>1</id_shop>
    <id_shop_group>0</id_shop_group>
    <quantity>${this.quantity}</quantity>
    <depends_on_stock>0</depends_on_stock>
    <out_of_stock>0</out_of_stock>
  </stock_available>
</prestashop>`;
  }
}
