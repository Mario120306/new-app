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
        // Extract name from <name><language>...</language></name>
        let name = ''
        const nameEl = el.querySelector('name')
        if (nameEl) {
          const languageEl = nameEl.querySelector('language')
          if (languageEl && languageEl.textContent) {
            name = languageEl.textContent.trim()
          }
        }
        
        // Extract description similarly
        let description = ''
        const descEl = el.querySelector('description')
        if (descEl) {
          const langDescEl = descEl.querySelector('language')
          if (langDescEl && langDescEl.textContent) {
            description = langDescEl.textContent.trim()
          }
        }
        
        // Extract link_rewrite similarly
        let linkRewrite = ''
        const linkEl = el.querySelector('link_rewrite')
        if (linkEl) {
          const langLinkEl = linkEl.querySelector('language')
          if (langLinkEl && langLinkEl.textContent) {
            linkRewrite = langLinkEl.textContent.trim()
          }
        }
        
        const activeText = el.querySelector('active')?.textContent?.trim() || ''

        // eslint-disable-next-line no-console
        console.debug(`Category ID ${id}: name="${name}"`)

        categories.push(new Category(id, {
          name,
          description,
          link_rewrite: linkRewrite,
          active: activeText === '1' || activeText === 'true',
        }))
      }
    })
    return categories
  }

  createOneBy(doc: Document): Category {
    const el = doc.querySelector('category')
    if (!el) return new Category()
    
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
    
    // Extract name from <name><language>...</language></name>
    let name = ''
    const nameEl = el.querySelector('name')
    if (nameEl) {
      const languageEl = nameEl.querySelector('language')
      if (languageEl && languageEl.textContent) {
        name = languageEl.textContent.trim()
      }
    }
    
    // Extract description similarly
    let description = ''
    const descEl = el.querySelector('description')
    if (descEl) {
      const langDescEl = descEl.querySelector('language')
      if (langDescEl && langDescEl.textContent) {
        description = langDescEl.textContent.trim()
      }
    }
    
    // Extract link_rewrite similarly
    let linkRewrite = ''
    const linkEl = el.querySelector('link_rewrite')
    if (linkEl) {
      const langLinkEl = linkEl.querySelector('language')
      if (langLinkEl && langLinkEl.textContent) {
        linkRewrite = langLinkEl.textContent.trim()
      }
    }
    
    const activeText = el.querySelector('active')?.textContent?.trim() || ''
    return new Category(id, {
      name,
      description,
      link_rewrite: linkRewrite,
      active: activeText === '1' || activeText === 'true',
    })
  }
}
