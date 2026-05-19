import { Mere } from './Mere'

const DEFAULT_LANG_ID = 1

function xmlCdata(value: string): string {
	return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function renderLangField(tagName: string, value?: string): string {
	if (!value) return ''
	const v = value.trim()
	if (!v) return ''
	return `<${tagName}><language id="${DEFAULT_LANG_ID}">${xmlCdata(v)}</language></${tagName}>`
}

export class ProductOptionValue extends Mere {
	id?: number
	id_attribute_group?: number
	name?: string

	constructor(id: number = 0, data?: any) {
		super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'product_option_values', 'product_option_value')
		this.id = id || undefined
		if (data) {
			this.id_attribute_group = data.id_attribute_group
			this.name = data.name
		}
	}

	getResourcePlural(): string {
		return 'product_option_values'
	}

	getResourceSingular(): string {
		return 'product_option_value'
	}

	getCreateXML(): string {
		if (!this.id_attribute_group) {
			throw new Error('id_attribute_group est requis pour créer un product_option_value')
		}

		return (
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
			`  <product_option_value>\n` +
			`    <id_attribute_group xlink:href="/prestashop/api/product_options/${this.id_attribute_group}">${this.id_attribute_group}</id_attribute_group>\n` +
			`    ${renderLangField('name', this.name)}\n` +
			`  </product_option_value>\n` +
			`</prestashop>`
		)
 	}
}
