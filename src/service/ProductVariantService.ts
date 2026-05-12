import type { BaseService } from './BaseService';
import { ProductVariant } from '../entities/ProductVariant';

export class ProductVariantService implements BaseService<ProductVariant> {
  private productVariants: ProductVariant[] = [];

  getAll(): ProductVariant[] {
    return this.productVariants;
  }

  getById(id: number): ProductVariant | undefined {
    return this.productVariants.find((v) => v.id === id);
  }

  add(item: ProductVariant): ProductVariant {
    const newId = Math.max(...this.productVariants.map((v) => v.id), 0) + 1;
    item.id = newId;
    this.productVariants.push(item);
    return item;
  }

  deleteById(id: number): boolean {
    const index = this.productVariants.findIndex((v) => v.id === id);
    if (index !== -1) {
      this.productVariants.splice(index, 1);
      return true;
    }
    return false;
  }

  resetData(): void {
    this.productVariants = [];
  }

  createListBy(doc: Document): ProductVariant[] {
    const variants: ProductVariant[] = [];
    const elements = doc.querySelectorAll('product_attribute');
    elements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10);
      const reference = el.querySelector('reference')?.textContent || '';
      const specificite = el.querySelector('specificite')?.textContent || '';
      const karazany = el.querySelector('karazany')?.textContent || '';
      const stock = parseInt(el.querySelector('stock_initial')?.textContent || '0', 10);
      const price = parseFloat(el.querySelector('prix_vente_ttc')?.textContent || '0');

      variants.push(
        new ProductVariant(id, 0, reference, specificite, karazany, stock, price)
      );
    });
    return variants;
  }

  createOneBy(doc: Document): ProductVariant {
    const el = doc.querySelector('product_attribute');
    if (!el) return new ProductVariant();

    const id = parseInt(el.getAttribute('id') || '0', 10);
    const reference = el.querySelector('reference')?.textContent || '';
    const specificite = el.querySelector('specificite')?.textContent || '';
    const karazany = el.querySelector('karazany')?.textContent || '';
    const stock = parseInt(el.querySelector('stock_initial')?.textContent || '0', 10);
    const price = parseFloat(el.querySelector('prix_vente_ttc')?.textContent || '0');

    return new ProductVariant(id, 0, reference, specificite, karazany, stock, price);
  }
}
