import { Mere } from './Mere'

const DEFAULT_LANG_ID = 1

function xmlCdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function toLinkRewrite(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function renderLangField(tagName: string, value?: string): string {
  if (!value) return ''
  const v = value.trim()
  if (!v) return ''
  return `<${tagName}><language id="${DEFAULT_LANG_ID}">${xmlCdata(v)}</language></${tagName}>`
}

export class Category extends Mere {
  id: number
  id_parent?: number
  id_parent_href?: string
  name?: string
  description?: string
  link_rewrite?: string
  active?: boolean

  constructor(id: number = 0, data?: any) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'categories', 'category')
    this.id = id
    if (data) {
      this.id_parent = data.id_parent
      this.id_parent_href = data.id_parent_href
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
    const idParent = this.id_parent ?? 2
    const idParentLine = this.id_parent_href
      ? `<id_parent xlink:href="${this.id_parent_href}">${idParent}</id_parent>`
      : `<id_parent>${idParent}</id_parent>`
    const linkRewrite = this.link_rewrite?.trim() || (this.name ? toLinkRewrite(this.name) : '')
    const active = typeof this.active === 'boolean' ? this.active : true

    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
      `  <category>\n` +
      `    ${idParentLine}\n` +
      `    ${renderLangField('name', this.name)}\n` +
      `    ${renderLangField('description', this.description)}\n` +
      `    ${renderLangField('link_rewrite', linkRewrite)}\n` +
      `    <active>${Number(active)}</active>\n` +
      `  </category>\n` +
      `</prestashop>`
    )
  }
}
