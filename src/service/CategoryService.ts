import { Category } from '../entities/Category'
import { BaseService } from './BaseService'

export class CategoryService extends BaseService<Category> {
  constructor() {
    super()
  }

  parseResponse(xml: string): Category[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'application/xml')
    const categories: Category[] = []

    const categoryElements = doc.querySelectorAll('category')
    categoryElements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10)
      if (id > 0) {
        const category = new Category(id)
        categories.push(category)
      }
    })

    return categories
  }

  resetData(): void {
    // API-only, no local data
  }
}
