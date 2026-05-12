import { Address } from '../entities/Address'
import { BaseService } from './BaseService'

export class AddressService extends BaseService<Address> {
  constructor() {
    super()
  }

  parseResponse(xml: string): Address[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'application/xml')
    const addresses: Address[] = []

    const addressElements = doc.querySelectorAll('address')
    addressElements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10)
      if (id > 0) {
        const address = new Address(id)
        addresses.push(address)
      }
    })

    return addresses
  }

  resetData(): void {
    // API-only, no local data
  }
}
