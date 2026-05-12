import { Product } from '../entities/Product'
import type { BaseService } from './BaseService'

export class ProductService implements BaseService<Product> {
    private products: Product[] = []

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

            // associations: categories, tags, attachments, accessories
            const associationsNode = node.getElementsByTagName('associations')[0]
            const parseAssoc = (tagName: string) => {
                if (!associationsNode) return undefined
                const tagList = Array.from(associationsNode.getElementsByTagName(tagName))[0]
                if (!tagList) return undefined
                const items = Array.from(tagList.getElementsByTagName(tagName.slice(0, -1)))
                return items.map((it) => ({ value: Number(it.getElementsByTagName('id')[0]?.textContent || 0) }))
            }

            const associations: any = {}
            const cats = parseAssoc('categories')
            if (cats) associations.categories = cats
            const tags = parseAssoc('tags')
            if (tags) associations.tags = tags

            // build Product constructor argument object
            const obj: any = {
                id,
                name,
                price,
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