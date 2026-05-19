import { Mere } from './Mere'

export class TaxRuleGroup extends Mere {
	id?: number
	name?: string
	active?: boolean

	constructor(id: number = 0, data?: any) {
		super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'tax_rule_groups', 'tax_rule_group')
		this.id = id || undefined
		if (data) {
			this.name = data.name
			this.active = data.active
		}
	}

	getResourcePlural(): string {
		return 'tax_rule_groups'
	}

	getResourceSingular(): string {
		return 'tax_rule_group'
	}

	getCreateXML(): string {
		const active = typeof this.active === 'boolean' ? this.active : true
		return (
			`<?xml version="1.0" encoding="UTF-8"?>\n` +
			`<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n` +
			`  <tax_rule_group>\n` +
			(this.name ? `    <name><![CDATA[${this.name.replace(/]]>/g, ']]]]><![CDATA[>')}]]></name>\n` : '') +
			`    <active>${Number(active)}</active>\n` +
			`  </tax_rule_group>\n` +
			`</prestashop>`
		)
	}
}
