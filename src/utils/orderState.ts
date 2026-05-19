/** Valeurs CSV considérées comme « pas d'état » → panier uniquement. */
export function normalizeOrderEtat(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return ''

  const lowered = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    lowered === 'null' ||
    lowered === 'undefined' ||
    lowered === 'none' ||
    lowered === 'n/a' ||
    lowered === 'na' ||
    lowered === '-' ||
    lowered === 'vide' ||
    lowered === 'empty'
  ) {
    return ''
  }

  return trimmed
}

export function normalizeOrderEtatKey(raw: string | null | undefined): string {
  return normalizeOrderEtat(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Panier seul : état vide ou libellé « dans le panier ». */
export function isCartOnlyOrderState(raw: string | null | undefined): boolean {
  const key = normalizeOrderEtatKey(raw)
  return !key || key.includes('dans le panier')
}

/** id_order_state PrestaShop à partir du libellé CSV. */
export function resolveOrderStateId(raw: string | null | undefined): number {
  const stateLC = normalizeOrderEtatKey(raw)
  if (!stateLC || stateLC.includes('dans le panier')) return 1
  if (stateLC.includes('livr')) return 5
  if (stateLC.includes('paiement effectue') || stateLC.includes('paiement accepte') || stateLC.includes('pay')) {
    return 2
  }
  if (stateLC.includes('erreur')) return 8
  if (stateLC.includes('annul')) return 6
  return 1
}

export const ORDER_STATE_CART = 1
export const ORDER_STATE_PAID = 2
export const ORDER_STATE_DELIVERED = 5

/**
 * Une commande « Payée » ou « Livrée » doit générer un mouvement de stock (une fois par commande).
 * Panier / annulé / erreur : pas de mouvement.
 */
export function orderStateTriggersStockMovement(
  stateId?: number | null,
  stateLabel?: string | null
): boolean {
  if (stateId === ORDER_STATE_PAID || stateId === ORDER_STATE_DELIVERED) {
    return true
  }

  const key = (stateLabel || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (!key || key.includes('dans le panier') || key.includes('annul') || key.includes('erreur')) {
    return false
  }

  if (key.includes('livr')) return true
  if (
    key.includes('pay') ||
    key.includes('paiement effectue') ||
    key.includes('paiement accepte') ||
    key.includes('paiement accept')
  ) {
    return true
  }

  return false
}
