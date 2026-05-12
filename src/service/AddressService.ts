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
      const id = parseInt(el.getAttribute('id') || '0', 10)
      if (id > 0) {
        addresses.push(new Address(id))
      }
    })
    return addresses
  }

  createOneBy(doc: Document): Address {
    const el = doc.querySelector('address')
    if (!el) return new Address()
    const id = parseInt(el.getAttribute('id') || '0', 10)
    return new Address(id)
  }
}
