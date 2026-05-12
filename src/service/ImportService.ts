import { Product } from '../entities/Product';
import { ProductVariant } from '../entities/ProductVariant';
import { Customer } from '../entities/Customer';
import { Order } from '../entities/Order';

export class ImportService {
  async importProducts(products: Product[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/products`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(product.getWsKey() + ':'),
            },
            body: product.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Produit "${product.name}": créé (${response.status})`);
        } else {
          failed++;
          logs.push(`Produit "${product.name}": échoué (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(`Produit "${product.name}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  async importVariants(variants: ProductVariant[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const variant of variants) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/combinations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(variant.getWsKey() + ':'),
            },
            body: variant.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Variante "${variant.reference}" ${variant.karazany}: créée (${response.status})`);
        } else {
          failed++;
          logs.push(`Variante "${variant.reference}" ${variant.karazany}: échouée (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(
          `Variante "${variant.reference}": erreur - ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { success, failed, logs };
  }

  async importCustomers(customers: Customer[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/customers`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(customer.getWsKey() + ':'),
            },
            body: customer.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Client "${customer.firstname}": créé (${response.status})`);
        } else {
          failed++;
          logs.push(`Client "${customer.firstname}": échoué (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(`Client "${customer.firstname}": erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }

  async importOrders(orders: Order[]): Promise<{ success: number; failed: number; logs: string[] }> {
    const logs: string[] = [];
    let success = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api'}/orders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/xml',
              Authorization: 'Basic ' + btoa(order.getWsKey() + ':'),
            },
            body: order.getCreateXML(),
          }
        );

        if (response.ok) {
          success++;
          logs.push(`Commande ${order.id}: créée (${response.status})`);
        } else {
          failed++;
          logs.push(`Commande ${order.id}: échouée (${response.status})`);
        }
      } catch (err) {
        failed++;
        logs.push(`Commande ${order.id}: erreur - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { success, failed, logs };
  }
}
