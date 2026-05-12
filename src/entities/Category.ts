import { Mere } from './Mere'

export class Category extends Mere {
  id: number
  id_parent?: number
  name?: string
  description?: string
  link_rewrite?: string
  active?: boolean

  constructor(id: number = 0, data?: any) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'categories', 'category')
    this.id = id
    if (data) {
      this.id_parent = data.id_parent
      this.name = data.name
      this.description = data.description
      this.link_rewrite = data.link_rewrite
      this.active = data.active
    }
  }

  getResourcePlural(): string {
    return 'categories'
  }

  getResourceSingular(): string {
    return 'category'
  }

  getCreateXML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n  <category>\n    ${this.id_parent ? `<id_parent>${this.id_parent}</id_parent>` : ''}\n    ${this.name ? `<name>${this.name}</name>` : ''}\n    ${this.description ? `<description>${this.description}</description>` : ''}\n    ${this.link_rewrite ? `<link_rewrite>${this.link_rewrite}</link_rewrite>` : ''}\n    ${typeof this.active === 'boolean' ? `<active>${Number(this.active)}</active>` : ''}\n  </category>\n</prestashop>`
  }
}
