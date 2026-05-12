import type { BaseService } from './BaseService';
import { Order } from '../entities/Order';
import type { OrderItem } from '../entities/Order';

export class OrderService implements BaseService<Order> {
  private orders: Order[] = [];

  getAll(): Order[] {
    return this.orders;
  }

  getById(id: number): Order | undefined {
    return this.orders.find((o) => o.id === id);
  }

  add(item: Order): Order {
    const newId = Math.max(...this.orders.map((o) => o.id), 0) + 1;
    item.id = newId;
    this.orders.push(item);
    return item;
  }

  deleteById(id: number): boolean {
    const index = this.orders.findIndex((o) => o.id === id);
    if (index !== -1) {
      this.orders.splice(index, 1);
      return true;
    }
    return false;
  }

  resetData(): void {
    this.orders = [];
  }

  createListBy(doc: Document): Order[] {
    const orderList: Order[] = [];
    const elements = doc.querySelectorAll('order');
    elements.forEach((el) => {
      const id = parseInt(el.getAttribute('id') || '0', 10);
      const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10);
      const customer_email = el.querySelector('customer_email')?.textContent || '';
      const customer_name = el.querySelector('customer_name')?.textContent || '';
      const date_add = el.querySelector('date_add')?.textContent || new Date().toISOString();
      const state = el.querySelector('state')?.textContent || '';
      const total_paid = parseFloat(el.querySelector('total_paid')?.textContent || '0');

      const items: OrderItem[] = [];
      const itemElements = el.querySelectorAll('item');
      itemElements.forEach((itemEl) => {
        items.push({
          reference: itemEl.querySelector('reference')?.textContent || '',
          quantity: parseInt(itemEl.querySelector('quantity')?.textContent || '0', 10),
          variant: itemEl.querySelector('variant')?.textContent || '',
        });
      });

      orderList.push(
        new Order(id, id_customer, customer_email, customer_name, date_add, state, items, total_paid)
      );
    });
    return orderList;
  }

  createOneBy(doc: Document): Order {
    const el = doc.querySelector('order');
    if (!el) return new Order();

    const id = parseInt(el.getAttribute('id') || '0', 10);
    const id_customer = parseInt(el.querySelector('id_customer')?.textContent || '0', 10);
    const customer_email = el.querySelector('customer_email')?.textContent || '';
    const customer_name = el.querySelector('customer_name')?.textContent || '';
    const date_add = el.querySelector('date_add')?.textContent || new Date().toISOString();
    const state = el.querySelector('state')?.textContent || '';
    const total_paid = parseFloat(el.querySelector('total_paid')?.textContent || '0');

    const items: OrderItem[] = [];
    const itemElements = el.querySelectorAll('item');
    itemElements.forEach((itemEl) => {
      items.push({
        reference: itemEl.querySelector('reference')?.textContent || '',
        quantity: parseInt(itemEl.querySelector('quantity')?.textContent || '0', 10),
        variant: itemEl.querySelector('variant')?.textContent || '',
      });
    });

    return new Order(id, id_customer, customer_email, customer_name, date_add, state, items, total_paid);
  }
}
