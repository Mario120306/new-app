export interface BaseService<T> {
    getAll(): T[]
    getById(id: number): T | undefined
    add(item: T): T
    deleteById(id: number): boolean
    resetData(): void
    // Parse an XML Document (from PrestaShop) into a list of T
    createListBy(doc: Document): T[]
    // Parse an XML Document (from PrestaShop) into a single T
    createOneBy(doc: Document): T
}