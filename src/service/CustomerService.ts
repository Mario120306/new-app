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

  createListBy(doc: Document): Customer[] {
    const customerList: Customer[] = [];
    const elements = doc.querySelectorAll('customer');
    elements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10);
      const firstname = el.querySelector('firstname')?.textContent || '';
      const lastname = el.querySelector('lastname')?.textContent || '';
      const email = el.querySelector('email')?.textContent || '';
      const password = el.querySelector('password')?.textContent || '';
      const address = el.querySelector('address')?.textContent || '';
      const date_add = el.querySelector('date_add')?.textContent || new Date().toISOString();

      customerList.push(
        new Customer(id, firstname, lastname, email, password, address, date_add)
      );
    });
    return customerList;
  }

  createOneBy(doc: Document): Customer {
    const el = doc.querySelector('customer');
    if (!el) return new Customer();

    const id = parseInt(el.getAttribute('id') || '0', 10);
    const firstname = el.querySelector('firstname')?.textContent || '';
    const lastname = el.querySelector('lastname')?.textContent || '';
    const email = el.querySelector('email')?.textContent || '';
    const password = el.querySelector('password')?.textContent || '';
    const address = el.querySelector('address')?.textContent || '';
    const date_add = el.querySelector('date_add')?.textContent || new Date().toISOString();

    return new Customer(id, firstname, lastname, email, password, address, date_add);
  }
}
