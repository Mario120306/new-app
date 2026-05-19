import { Address } from '../entities/Address'
import type { BaseService } from './BaseService'

export class AddressService implements BaseService<Address> {
  private addresses: Address[] = []

  getAll(): Address[] {
    return this.addresses
  }

  getById(id: number): Address | undefined {
    return this.addresses.find((a) => a.id === id)
  }

  add(item: Address): Address {
    this.addresses.push(item)
    return item
  }

  deleteById(id: number): boolean {
    const index = this.addresses.findIndex((a) => a.id === id)
    if (index > -1) {
      this.addresses.splice(index, 1)
      return true
    }
    return false
  }

  resetData(): void {
    this.addresses = []
  }

  createListBy(doc: Document): Address[] {
    const addresses: Address[] = []
    const addressElements = doc.querySelectorAll('address')
    addressElements.forEach((el) => {
      // Extract ID from attribute or <id> child
      let id = 0
      const idAttr = el.getAttribute('id')
      if (idAttr) {
        id = parseInt(idAttr, 10)
      } else {
        const idEl = el.querySelector('id')
        if (idEl && idEl.textContent) id = parseInt(idEl.textContent.trim(), 10)
      }
      if (id > 0) {
        const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10)
        const id_country = parseInt(el.querySelector('id_country')?.textContent || '0', 10)
        const firstname = el.querySelector('firstname')?.textContent || ''
        const lastname = el.querySelector('lastname')?.textContent || ''
        const address1 = el.querySelector('address1')?.textContent || ''
        const city = el.querySelector('city')?.textContent || ''
        const postcode = el.querySelector('postcode')?.textContent || ''

        const address = new Address(id, {
          id_customer,
          id_country,
          firstname,
          lastname,
          address1,
          city,
          postcode
        })
        addresses.push(address)
      }
    })
    return addresses
  }

  createOneBy(doc: Document): Address {
    const el = doc.querySelector('address')
    if (!el) return new Address()

    let id = 0
    const idAttr = el.getAttribute('id')
    if (idAttr) {
      id = parseInt(idAttr, 10)
    } else {
      const idEl = el.querySelector('id')
      if (idEl && idEl.textContent) id = parseInt(idEl.textContent.trim(), 10)
    }
    if (id <= 0) return new Address()

    const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10)
    const id_country = parseInt(el.querySelector('id_country')?.textContent || '0', 10)
    const firstname = el.querySelector('firstname')?.textContent || ''
    const lastname = el.querySelector('lastname')?.textContent || ''
    const address1 = el.querySelector('address1')?.textContent || ''
    const city = el.querySelector('city')?.textContent || ''
    const postcode = el.querySelector('postcode')?.textContent || ''

    return new Address(id, {
      id_customer,
      id_country,
      firstname,
      lastname,
      address1,
      city,
      postcode
    })
  }
}
