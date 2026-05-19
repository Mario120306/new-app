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
  alias?: string

  constructor(id: number = 0, data?: any) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'addresses', 'address')
    this.id = id
    if (data) {
      this.id_customer = data.id_customer
      this.id_country = data.id_country
      this.firstname = data.firstname
      this.lastname = data.lastname
      this.address1 = data.address1
      this.city = data.city
      this.postcode = data.postcode
      this.alias = data.alias
    }
  }

  getResourcePlural(): string {
    return 'addresses'
  }

  getResourceSingular(): string {
    return 'address'
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
    const alias = this.xmlEscape(this.alias || 'Adresse par défaut')
    const firstname = this.firstname ? this.xmlEscape(this.firstname) : ''
    const lastname = this.lastname ? this.xmlEscape(this.lastname) : ''
    const address1 = this.address1 ? this.xmlEscape(this.address1) : ''
    const city = this.city ? this.xmlEscape(this.city) : ''
    const postcode = this.postcode ? this.xmlEscape(this.postcode) : ''

    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n  <address>\n    ${this.id_customer ? `<id_customer>${this.id_customer}</id_customer>` : ''}\n    ${this.id_country ? `<id_country>${this.id_country}</id_country>` : ''}\n    <alias>${alias}</alias>\n    ${firstname ? `<firstname>${firstname}</firstname>` : ''}\n    ${lastname ? `<lastname>${lastname}</lastname>` : ''}\n    ${address1 ? `<address1>${address1}</address1>` : ''}\n    ${city ? `<city>${city}</city>` : ''}\n    ${postcode ? `<postcode>${postcode}</postcode>` : ''}\n  </address>\n</prestashop>`
  }
}
