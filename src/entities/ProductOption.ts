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

export class ProductOption extends Mere {
	id?: number
	name?: string
	public_name?: string
	group_type?: string

	constructor(id: number = 0, data?: any) {
		super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'product_options', 'product_option')
		this.id = id || undefined
		if (data) {
			this.name = data.name
			this.public_name = data.public_name
			this.group_type = data.group_type
		}
	}

	getResourcePlural(): string {
		return 'product_options'
	}

	getResourceSingular(): string {
		return 'product_option'
	}

	getCreateXML(): string {
		const groupType = this.group_type || 'select'
		return (
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
			`  <product_option>\n` +
			`    <group_type>${groupType}</group_type>\n` +
			`    ${renderLangField('name', this.name)}\n` +
			`    ${renderLangField('public_name', this.public_name || this.name)}\n` +
			`  </product_option>\n` +
			`</prestashop>`
		)
	}
}
