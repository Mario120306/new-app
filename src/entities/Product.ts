import { Mere } from './Mere'
import type { LinkAndValue } from '../utils/LinkAndValue'
import { dateToString } from '../utils/DateFormatter'

type ProductAssociationItem = LinkAndValue<number>

type ProductAssociations = {
	categories?: ProductAssociationItem[]
	tags?: ProductAssociationItem[]
	attachments?: ProductAssociationItem[]
	accessories?: ProductAssociationItem[]
}

export class Product extends Mere {
	id?: number
	id_manufacturer?: number
	id_supplier?: number
	id_category_default?: number
	new?: boolean
	cache_default_attribute?: number
	id_default_image?: number
	id_default_combination?: number
	id_tax_rules_group?: number
	position_in_category?: number
	manufacturer_name?: string
	quantity?: number
	type?: string
	id_shop_default?: number
	reference?: string
	supplier_reference?: string
	location?: string
	width?: number
	height?: number
	depth?: number
	weight?: number
	ean13?: string
	isbn?: string
	upc?: string
	mpn?: string
	cache_is_pack?: boolean
	cache_has_attachments?: boolean
	state?: number
	active?: boolean
	redirect_type?: string
	id_type_redirected?: number
	available_for_order?: boolean
	available_date?: Date
	show_condition?: boolean
	condition?: string
	show_price?: boolean
	indexed?: boolean
	visibility?: string
	advanced_stock_management?: boolean
	date_add?: Date
	date_upd?: Date
	pack_stock_type?: number
	minimal_quantity?: number
	low_stock_threshold?: number
	low_stock_alert?: boolean
	price?: number
	wholesale_price?: number
	unity?: string
	meta_title?: string
	meta_keywords?: string
	meta_description?: string
	link_rewrite?: string
	name?: string
	description?: string
	description_short?: string
	available_now?: string
	available_later?: string
	associations?: ProductAssociations

	constructor(
		{
			id,
			id_manufacturer,
			id_supplier,
			id_category_default,
			new: isNew,
			cache_default_attribute,
			id_default_image,
			id_default_combination,
			id_tax_rules_group,
			position_in_category,
			manufacturer_name,
			quantity,
			type,
			id_shop_default,
			reference,
			supplier_reference,
			location,
			width,
			height,
			depth,
			weight,
			ean13,
			isbn,
			upc,
			mpn,
			cache_is_pack,
			cache_has_attachments,
			state,
			active,
			redirect_type,
			id_type_redirected,
			available_for_order,
			available_date,
			show_condition,
			condition,
			show_price,
			indexed,
			visibility,
			advanced_stock_management,
			date_add,
			date_upd,
			pack_stock_type,
			minimal_quantity,
			low_stock_threshold,
			low_stock_alert,
			price,
			wholesale_price,
			unity,
			meta_title,
			meta_keywords,
			meta_description,
			link_rewrite,
			name,
			description,
			description_short,
			available_now,
			available_later,
			associations,
		}:
			{
				id?: number
				id_manufacturer?: number
				id_supplier?: number
				id_category_default?: number
				new?: boolean
				cache_default_attribute?: number
				id_default_image?: number
				id_default_combination?: number
				id_tax_rules_group?: number
				position_in_category?: number
				manufacturer_name?: string
				quantity?: number
				type?: string
				id_shop_default?: number
				reference?: string
				supplier_reference?: string
				location?: string
				width?: number
				height?: number
				depth?: number
				weight?: number
				ean13?: string
				isbn?: string
				upc?: string
				mpn?: string
				cache_is_pack?: boolean
				cache_has_attachments?: boolean
				state?: number
				active?: boolean
				redirect_type?: string
				id_type_redirected?: number
				available_for_order?: boolean
				available_date?: Date
				show_condition?: boolean
				condition?: string
				show_price?: boolean
				indexed?: boolean
				visibility?: string
				advanced_stock_management?: boolean
				date_add?: Date
				date_upd?: Date
				pack_stock_type?: number
				minimal_quantity?: number
				low_stock_threshold?: number
				low_stock_alert?: boolean
				price?: number
				wholesale_price?: number
				unity?: string
				meta_title?: string
				meta_keywords?: string
				meta_description?: string
				link_rewrite?: string
				name?: string
				description?: string
				description_short?: string
				available_now?: string
				available_later?: string
				associations?: ProductAssociations
			} = {},
	) {
		super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'products', 'product')
		this.id = id
		this.id_manufacturer = id_manufacturer
		this.id_supplier = id_supplier
		this.id_category_default = id_category_default
		this.new = isNew
		this.cache_default_attribute = cache_default_attribute
		this.id_default_image = id_default_image
		this.id_default_combination = id_default_combination
		this.id_tax_rules_group = id_tax_rules_group
		this.position_in_category = position_in_category
		this.manufacturer_name = manufacturer_name
		this.quantity = quantity
		this.type = type
		this.id_shop_default = id_shop_default
		this.reference = reference
		this.supplier_reference = supplier_reference
		this.location = location
		this.width = width
		this.height = height
		this.depth = depth
		this.weight = weight
		this.ean13 = ean13
		this.isbn = isbn
		this.upc = upc
		this.mpn = mpn
		this.cache_is_pack = cache_is_pack
		this.cache_has_attachments = cache_has_attachments
		this.state = state
		this.active = active
		this.redirect_type = redirect_type
		this.id_type_redirected = id_type_redirected
		this.available_for_order = available_for_order
		this.available_date = available_date
		this.show_condition = show_condition
		this.condition = condition
		this.show_price = show_price
		this.indexed = indexed
		this.visibility = visibility
		this.advanced_stock_management = advanced_stock_management
		this.date_add = date_add
		this.date_upd = date_upd
		this.pack_stock_type = pack_stock_type
		this.minimal_quantity = minimal_quantity
		this.low_stock_threshold = low_stock_threshold
		this.low_stock_alert = low_stock_alert
		this.price = price
		this.wholesale_price = wholesale_price
		this.unity = unity
		this.meta_title = meta_title
		this.meta_keywords = meta_keywords
		this.meta_description = meta_description
		this.link_rewrite = link_rewrite
		this.name = name
		this.description = description
		this.description_short = description_short
		this.available_now = available_now
		this.available_later = available_later
		this.associations = associations
	}

	private renderItems(tagName: string, items?: ProductAssociationItem[]): string {
		if (!items?.length) {
			return ''
		}

		return items.map((item) => `
					<${tagName}><id>${item.value}</id></${tagName}>`).join('')
	}

	getCreateXML(): string {
		return `
			<prestashop>
				<product>
				${this.id ? `<id>${this.id}</id>` : ''}
				${this.id_manufacturer ? `<id_manufacturer>${this.id_manufacturer}</id_manufacturer>` : ''}
				${this.id_supplier ? `<id_supplier>${this.id_supplier}</id_supplier>` : ''}
				${this.id_category_default ? `<id_category_default>${this.id_category_default}</id_category_default>` : ''}
				${typeof this.new === 'boolean' ? `<new>${Number(this.new)}</new>` : ''}
				${this.cache_default_attribute ? `<cache_default_attribute>${this.cache_default_attribute}</cache_default_attribute>` : ''}
				${this.id_default_image ? `<id_default_image>${this.id_default_image}</id_default_image>` : ''}
				${this.id_default_combination ? `<id_default_combination>${this.id_default_combination}</id_default_combination>` : ''}
				${this.id_tax_rules_group ? `<id_tax_rules_group>${this.id_tax_rules_group}</id_tax_rules_group>` : ''}
				${this.position_in_category ? `<position_in_category>${this.position_in_category}</position_in_category>` : ''}
				${this.manufacturer_name ? `<manufacturer_name>${this.manufacturer_name}</manufacturer_name>` : ''}
				${this.quantity !== undefined ? `<quantity>${this.quantity}</quantity>` : ''}
				${this.type ? `<type>${this.type}</type>` : ''}
				${this.id_shop_default ? `<id_shop_default>${this.id_shop_default}</id_shop_default>` : ''}
				${this.reference ? `<reference>${this.reference}</reference>` : ''}
				${this.supplier_reference ? `<supplier_reference>${this.supplier_reference}</supplier_reference>` : ''}
				${this.location ? `<location>${this.location}</location>` : ''}
				${this.width !== undefined ? `<width>${this.width}</width>` : ''}
				${this.height !== undefined ? `<height>${this.height}</height>` : ''}
				${this.depth !== undefined ? `<depth>${this.depth}</depth>` : ''}
				${this.weight !== undefined ? `<weight>${this.weight}</weight>` : ''}
				${this.ean13 ? `<ean13>${this.ean13}</ean13>` : ''}
				${this.isbn ? `<isbn>${this.isbn}</isbn>` : ''}
				${this.upc ? `<upc>${this.upc}</upc>` : ''}
				${this.mpn ? `<mpn>${this.mpn}</mpn>` : ''}
				${typeof this.cache_is_pack === 'boolean' ? `<cache_is_pack>${Number(this.cache_is_pack)}</cache_is_pack>` : ''}
				${typeof this.cache_has_attachments === 'boolean' ? `<cache_has_attachments>${Number(this.cache_has_attachments)}</cache_has_attachments>` : ''}
				${this.state !== undefined ? `<state>${this.state}</state>` : ''}
				${typeof this.active === 'boolean' ? `<active>${Number(this.active)}</active>` : ''}
				${this.redirect_type ? `<redirect_type>${this.redirect_type}</redirect_type>` : ''}
				${this.id_type_redirected ? `<id_type_redirected>${this.id_type_redirected}</id_type_redirected>` : ''}
				${typeof this.available_for_order === 'boolean' ? `<available_for_order>${Number(this.available_for_order)}</available_for_order>` : ''}
				${this.available_date ? `<available_date>${dateToString(this.available_date).split(' ')[0]}</available_date>` : ''}
				${typeof this.show_condition === 'boolean' ? `<show_condition>${Number(this.show_condition)}</show_condition>` : ''}
				${this.condition ? `<condition>${this.condition}</condition>` : ''}
				${typeof this.show_price === 'boolean' ? `<show_price>${Number(this.show_price)}</show_price>` : ''}
				${typeof this.indexed === 'boolean' ? `<indexed>${Number(this.indexed)}</indexed>` : ''}
				${this.visibility ? `<visibility>${this.visibility}</visibility>` : ''}
				${typeof this.advanced_stock_management === 'boolean' ? `<advanced_stock_management>${Number(this.advanced_stock_management)}</advanced_stock_management>` : ''}
				${this.date_add ? `<date_add>${dateToString(this.date_add)}</date_add>` : ''}
				${this.date_upd ? `<date_upd>${dateToString(this.date_upd)}</date_upd>` : ''}
				${this.pack_stock_type !== undefined ? `<pack_stock_type>${this.pack_stock_type}</pack_stock_type>` : ''}
				${this.minimal_quantity !== undefined ? `<minimal_quantity>${this.minimal_quantity}</minimal_quantity>` : ''}
				${this.low_stock_threshold !== undefined ? `<low_stock_threshold>${this.low_stock_threshold}</low_stock_threshold>` : ''}
				${typeof this.low_stock_alert === 'boolean' ? `<low_stock_alert>${Number(this.low_stock_alert)}</low_stock_alert>` : ''}
				${this.price !== undefined ? `<price>${this.price}</price>` : ''}
				${this.wholesale_price !== undefined ? `<wholesale_price>${this.wholesale_price}</wholesale_price>` : ''}
				${this.unity ? `<unity>${this.unity}</unity>` : ''}
				${this.meta_title ? `<meta_title>${this.meta_title}</meta_title>` : ''}
				${this.meta_keywords ? `<meta_keywords>${this.meta_keywords}</meta_keywords>` : ''}
				${this.meta_description ? `<meta_description>${this.meta_description}</meta_description>` : ''}
				${this.link_rewrite ? `<link_rewrite>${this.link_rewrite}</link_rewrite>` : ''}
				${this.name ? `<name>${this.name}</name>` : ''}
				${this.description ? `<description>${this.description}</description>` : ''}
				${this.description_short ? `<description_short>${this.description_short}</description_short>` : ''}
				${this.available_now ? `<available_now>${this.available_now}</available_now>` : ''}
				${this.available_later ? `<available_later>${this.available_later}</available_later>` : ''}

				<associations>
					<categories>${this.renderItems('category', this.associations?.categories)}</categories>
					<tags>${this.renderItems('tag', this.associations?.tags)}</tags>
					<attachments>${this.renderItems('attachment', this.associations?.attachments)}</attachments>
					<accessories>${this.renderItems('accessory', this.associations?.accessories)}</accessories>
				</associations>
				</product>
			</prestashop>
		`.trim()
	}
}

