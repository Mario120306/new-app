import { Mere } from './Mere'

export class Address extends Mere {
  id: number
  id_customer?: number
  id_country?: number
  firstname?: string
  lastname?: string
  address1?: string
  city?: string
  postcode?: string

  constructor(id: number = 0, data?: any) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'addresses', 'address')
    this.id = id
    if (data) {
      this.id_customer = data.id_customer
      this.id_country = data.id_country
      this.firstname = data.firstname
      this.lastname = data.lastname
      this.address1 = data.address1
      this.city = data.city
      this.postcode = data.postcode
    }
  }

  getResourcePlural(): string {
    return 'addresses'
  }

  getResourceSingular(): string {
    return 'address'
  }

  getCreateXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n  <address>\n    ${this.id_customer ? `<id_customer>${this.id_customer}</id_customer>` : ''}\n    ${this.id_country ? `<id_country>${this.id_country}</id_country>` : ''}\n    ${this.firstname ? `<firstname>${this.firstname}</firstname>` : ''}\n    ${this.lastname ? `<lastname>${this.lastname}</lastname>` : ''}\n    ${this.address1 ? `<address1>${this.address1}</address1>` : ''}\n    ${this.city ? `<city>${this.city}</city>` : ''}\n    ${this.postcode ? `<postcode>${this.postcode}</postcode>` : ''}\n  </address>\n</prestashop>`
  }
}
