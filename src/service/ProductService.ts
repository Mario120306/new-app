import { Product } from '../entities/Product'
import type { BaseService } from './BaseService'

export class ProductService implements BaseService<Product> {
    private products: Product[] = []

    private parseDateValue(value?: string): Date | undefined {
        if (!value) return undefined
        const normalized = value.includes('T') ? value : value.replace(' ', 'T')
        const parsed = new Date(normalized)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    getAll(): Product[] {
        return [...this.products]
    }

    getById(id: number): Product | undefined {
        return this.products.find((product) => product.id === id)
    }

    add(item: Product): Product {
        this.products.push(item)
        return item
    }

    deleteById(id: number): boolean {
        const initialLength = this.products.length
        this.products = this.products.filter((product) => product.id !== id)
        return this.products.length !== initialLength
    }

    resetData(): void {
        this.products = []
    }

    createListBy(doc: Document): Product[] {
        const nodes = Array.from(doc.getElementsByTagName('product'))
        const results: Product[] = nodes.map((node) => {
            const get = (tag: string) => node.getElementsByTagName(tag)[0]?.textContent || undefined
            const getAttributeNumber = (tag: string, attribute: string) => {
                const value = node.getAttribute(attribute)
                if (value) return Number(value)

                const childValue = node.getElementsByTagName(tag)[0]?.getAttribute(attribute)
                return childValue ? Number(childValue) : undefined
            }

            const idText = get('id')
            const id = getAttributeNumber('id', 'id') ?? (idText ? Number(idText) : undefined)
            const name = get('name')
            const priceText = get('price')
            const price = priceText ? Number(priceText) : undefined
            const wholesalePriceText = get('wholesale_price')
            const wholesale_price = wholesalePriceText ? Number(wholesalePriceText) : undefined

            const id_category_default_text = get('id_category_default')
            const id_category_default = id_category_default_text ? Number(id_category_default_text) : undefined
            
            // Additional fields
            const reference = get('reference')
            const description_short = get('description_short')
            const description = get('description')
            const link_rewrite = get('link_rewrite')
            const quantityText = get('quantity')
            const quantity = quantityText ? Number(quantityText) : undefined
            const activeText = get('active')
            const active = activeText === '1' || activeText === 'true'
            const available_date = this.parseDateValue(get('available_date'))
            const date_add = this.parseDateValue(get('date_add'))
            const id_default_image_text = get('id_default_image')
            const id_default_image = id_default_image_text ? Number(id_default_image_text) : getAttributeNumber('image', 'id')

            // associations: categories, tags, attachments, accessories
            const associationsNode = node.getElementsByTagName('associations')[0]
            const parseAssoc = (tagName: string) => {
                if (!associationsNode) return undefined
                const tagList = Array.from(associationsNode.getElementsByTagName(tagName))[0]
                if (!tagList) return undefined
                const itemTagName = tagName === 'categories' ? 'category' : tagName.slice(0, -1)
                const items = Array.from(tagList.getElementsByTagName(itemTagName))
                return items.map((it) => {
                    const id = Number(it.getElementsByTagName('id')[0]?.textContent || 0)
                        const name = it.getElementsByTagName('name')[0]?.textContent
                    return { value: id, name }
                })
            }

            const associations: any = {}
            const cats = parseAssoc('categories')
            if (cats) associations.categories = cats
            const tags = parseAssoc('tags')
            if (tags) associations.tags = tags

            // build Product constructor argument object
            const obj: any = {
                id,
                id_category_default,
                name,
                price,
                wholesale_price,
                reference,
                description_short,
                description,
                link_rewrite,
                quantity,
                active,
                available_date,
                date_add,
                id_default_image,
                associations,
            }

            return new Product(obj)
        })

        // store into memory
        this.products = results
        return results
    }

    createOneBy(doc: Document): Product {
        const list = this.createListBy(doc)
        return list[0]
    }
}