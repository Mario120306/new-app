import { Carrier } from '../entities/Carrier'
import type { BaseService } from './BaseService'

export class CarrierService implements BaseService<Carrier> {
  private carriers: Carrier[] = []

  getAll(): Carrier[] {
    return this.carriers
  }

  getById(id: number): Carrier | undefined {
    return this.carriers.find((c) => c.id === id)
  }

  add(item: Carrier): Carrier {
    this.carriers.push(item)
    return item
  }

  deleteById(id: number): boolean {
    const index = this.carriers.findIndex((c) => c.id === id)
    if (index > -1) {
      this.carriers.splice(index, 1)
      return true
    }
    return false
  }

  resetData(): void {
    this.carriers = []
  }

  createListBy(doc: Document): Carrier[] {
    const carriers: Carrier[] = []
    const carrierElements = doc.querySelectorAll('carrier')
    carrierElements.forEach((el) => {
      // Extract ID from either attribute or child element
      let id = 0
      const idAttr = el.getAttribute('id')
      if (idAttr) {
        id = parseInt(idAttr, 10)
      } else {
        const idElement = el.querySelector('id')
        if (idElement && idElement.textContent) {
          id = parseInt(idElement.textContent.trim(), 10)
        }
      }

      if (id > 0) {
        const name = el.querySelector('name')?.textContent?.trim() || ''
        const activeText = el.querySelector('active')?.textContent?.trim() || ''
        const active = activeText === '1' || activeText === 'true'
        const delay = el.querySelector('delay')?.textContent?.trim() || ''

        const carrier = new Carrier(id, name, active, delay)
        carriers.push(carrier)
      }
    })
    return carriers
  }

  createOneBy(doc: Document): Carrier {
    const el = doc.querySelector('carrier')
    if (!el) return new Carrier()

    // Extract ID from either attribute or child element
    let id = 0
    const idAttr = el.getAttribute('id')
    if (idAttr) {
      id = parseInt(idAttr, 10)
    } else {
      const idElement = el.querySelector('id')
      if (idElement && idElement.textContent) {
        id = parseInt(idElement.textContent.trim(), 10)
      }
    }

    if (id <= 0) return new Carrier()

    const name = el.querySelector('name')?.textContent?.trim() || ''
    const activeText = el.querySelector('active')?.textContent?.trim() || ''
    const active = activeText === '1' || activeText === 'true'
    const delay = el.querySelector('delay')?.textContent?.trim() || ''

    return new Carrier(id, name, active, delay)
  }
}
