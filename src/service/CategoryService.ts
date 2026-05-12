import { Category } from '../entities/Category'
import type { BaseService } from './BaseService'

export class CategoryService implements BaseService<Category> {
  private categories: Category[] = []

  getAll(): Category[] {
    return this.categories
  }

  getById(id: number): Category | undefined {
    return this.categories.find((c) => c.id === id)
  }

  add(item: Category): Category {
    this.categories.push(item)
    return item
  }

  deleteById(id: number): boolean {
    const index = this.categories.findIndex((c) => c.id === id)
    if (index > -1) {
      this.categories.splice(index, 1)
      return true
    }
    return false
  }

  resetData(): void {
    this.categories = []
  }

  createListBy(doc: Document): Category[] {
    const categories: Category[] = []
    const categoryElements = doc.querySelectorAll('category')
    categoryElements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10)
      if (id > 0) {
        categories.push(new Category(id))
      }
    })
    return categories
  }

  createOneBy(doc: Document): Category {
    const el = doc.querySelector('category')
    if (!el) return new Category()
    const id = parseInt(el.getAttribute('id') || '0', 10)
    return new Category(id)
  }
}
