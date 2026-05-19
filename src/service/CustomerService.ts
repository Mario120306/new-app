import type { BaseService } from './BaseService';
import { Customer } from '../entities/Customer';

export class CustomerService implements BaseService<Customer> {
  private customers: Customer[] = [];

  getAll(): Customer[] {
    return this.customers;
  }

  getById(id: number): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  add(item: Customer): Customer {
    const newId = Math.max(...this.customers.map((c) => c.id), 0) + 1;
    item.id = newId;
    this.customers.push(item);
    return item;
  }

  deleteById(id: number): boolean {
    const index = this.customers.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.customers.splice(index, 1);
      return true;
    }
    return false;
  }

  resetData(): void {
    this.customers = [];
  }

  /**
   * ✅ FIX : dans le XML PrestaShop, l'id est une balise enfant <id><![CDATA[5]]></id>
   * et NON un attribut. Il faut utiliser el.querySelector('id')?.textContent
   */
  private parseId(el: Element): number {
    // Priorité 1 : balise enfant <id>
    const idText = el.querySelector(':scope > id')?.textContent?.trim()
    if (idText) {
      const parsed = parseInt(idText, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    // Priorité 2 : attribut id (fallback, peu probable avec PrestaShop)
    const idAttr = el.getAttribute('id')
    if (idAttr) {
      const parsed = parseInt(idAttr, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return 0
  }

  createListBy(doc: Document): Customer[] {
    const customerList: Customer[] = [];
    const elements = doc.querySelectorAll('customer');
    elements.forEach((el) => {
      const id       = this.parseId(el)
      const firstname = el.querySelector('firstname')?.textContent || '';
      const lastname  = el.querySelector('lastname')?.textContent || '';
      const email     = el.querySelector('email')?.textContent || '';
      const password  = el.querySelector('passwd')?.textContent || el.querySelector('password')?.textContent || '';
      const address   = el.querySelector('address')?.textContent || '';
      const date_add  = el.querySelector('date_add')?.textContent || new Date().toISOString();
      const note      = el.querySelector('note')?.textContent || '';

      console.log('[CustomerService] Parsed customer — id:', id, 'email:', email)

      customerList.push(
        new Customer(id, firstname, lastname, email, password, address, date_add, note)
      );
    });
    return customerList;
  }

  createOneBy(doc: Document): Customer {
    const el = doc.querySelector('customer');
    if (!el) return new Customer();

    const id        = this.parseId(el)
    const firstname = el.querySelector('firstname')?.textContent || '';
    const lastname  = el.querySelector('lastname')?.textContent || '';
    const email     = el.querySelector('email')?.textContent || '';
    const password  = el.querySelector('passwd')?.textContent || el.querySelector('password')?.textContent || '';
    const address   = el.querySelector('address')?.textContent || '';
    const date_add  = el.querySelector('date_add')?.textContent || new Date().toISOString();
    const note      = el.querySelector('note')?.textContent || '';

    console.log('[CustomerService] createOneBy — id:', id, 'email:', email)

    return new Customer(id, firstname, lastname, email, password, address, date_add, note);
  }
}