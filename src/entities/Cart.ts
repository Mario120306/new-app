import { Mere } from './Mere';

export class Cart extends Mere {
  id: number;
  id_customer?: number;
  date_add?: string;

  constructor(id: number = 0, id_customer?: number, date_add?: string) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'carts', 'cart');
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
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n  <cart>\n    <id_customer>${this.id_customer || ''}</id_customer>\n  </cart>\n</prestashop>`;
  }
}
