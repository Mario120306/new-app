export type CsvCatalogRow = {
  availableDate?: Date
  name: string
  reference: string
  priceTtc: number
  taxRate: number
  categoryName: string
  wholesalePrice?: number
}

export type CsvStockRow = {
  reference: string
  specificite?: string
  karazany?: string
  stockInitial: number
  prixVenteTtc?: number
}

import { normalizeOrderEtat } from '../utils/orderState'

export type CsvOrderRow = {
  date: Date
  name: string
  email: string
  pwd?: string
  adresse: string
  achat: string // raw string to be parsed later
  etat: string
}

export class CSVImportService {
  private normalizeHeaderKey(value: string): string {
    return value
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u0000/g, '')
      .replace(/\u00A0/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
  }

  /**
   * Vérifie la présence des colonnes obligatoires.
   */
  private validateColumns(headerFields: string[], expected: Array<string | string[]>, fileName: string) {
    const headers = headerFields.map((h) => this.normalizeHeaderKey(h));
    for (const exp of expected) {
      const aliases = Array.isArray(exp) ? exp : [exp]
      const found = aliases.some((name) => headers.includes(this.normalizeHeaderKey(name)))
      if (!found) {
        const expectedLabel = aliases[0]
        throw new Error(
          `[${fileName}] Nom de colonne non conforme : "${expectedLabel}" manquante (colonnes détectées: ${headers.join(', ')})`
        );
      }
    }
  }

  /**
   * Vérifie si une date est au format DD/MM/YYYY.
   */
  private checkDateFormat(raw: string): boolean {
    return /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(raw.trim());
  }

  /**
   * Parse le fichier Fiche Produit.
   */
  parseCatalogRowsFromCSV(fileText: string): CsvCatalogRow[] {
    const lines = this.getLines(fileText);
    if (lines.length <= 1) return []
    const delimiter = this.detectDelimiter(lines[0])
    const headerFields = this.parseDelimitedLine(lines[0], delimiter)
    
    // Validation des colonnes
    this.validateColumns(headerFields, [
      'date_availability_produit', 'nom', 'reference', 'prix_ttc', 'Taxe', 'categorie', 'prix_achat'
    ], 'Fiche Produit');

    const headerIndex = this.buildHeaderIndex(headerFields)
    const rows: CsvCatalogRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseDelimitedLine(lines[i], delimiter)
      if (fields.length === 0) continue

      const name = this.getField(fields, headerIndex, ['nom'])
      const reference = this.getField(fields, headerIndex, ['reference'])
      
      if (!name || !reference) continue

      const availableDateRaw = this.getField(fields, headerIndex, ['date_availability_produit'])
      if (availableDateRaw && !this.checkDateFormat(availableDateRaw)) {
        throw new Error(`Ligne ${i + 1}: format de date différente de DD/MM/YYYY ("${availableDateRaw}")`);
      }
      const availableDate = availableDateRaw ? this.parseDateFr(availableDateRaw) : undefined

      const priceTtcRaw = this.getField(fields, headerIndex, ['prix_ttc'])
      const priceTtc = this.parseNumberFr(priceTtcRaw)
      if (priceTtc < 0) throw new Error(`Ligne ${i + 1}: le prix_ttc doit être un montant positif ("${priceTtcRaw}")`);

      const taxRateRaw = this.getField(fields, headerIndex, ['taxe'])
      const taxRate = this.parsePercentFr(taxRateRaw)
      if (taxRate < 0) throw new Error(`Ligne ${i + 1}: la taxe doit être un montant positif ("${taxRateRaw}")`);

      const wholesaleRaw = this.getField(fields, headerIndex, ['prix_achat'])
      const wholesalePrice = wholesaleRaw ? this.parseNumberFr(wholesaleRaw) : undefined
      if (wholesalePrice !== undefined && wholesalePrice < 0) {
        throw new Error(`Ligne ${i + 1}: le prix d'achat doit être un montant positif ("${wholesaleRaw}")`);
      }

      rows.push({
        availableDate,
        name,
        reference,
        priceTtc,
        taxRate,
        categoryName: this.getField(fields, headerIndex, ['categorie']) || 'Home',
        wholesalePrice,
      })
    }

    return rows
  }

  /**
   * Parse la Fiche Stock.
   */
  parseStockRowsFromCSV(fileText: string): CsvStockRow[] {
    const lines = this.getLines(fileText);
    if (lines.length <= 1) return []
    const delimiter = this.detectDelimiter(lines[0])
    const headerFields = this.parseDelimitedLine(lines[0], delimiter)

    // Validation des colonnes
    this.validateColumns(headerFields, [
      'reference', 'specificité', 'karazany', 'stock_initial', 'prix_vente_ttc'
    ], 'Fiche Stock');

    const headerIndex = this.buildHeaderIndex(headerFields)
    const rows: CsvStockRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseDelimitedLine(lines[i], delimiter)
      if (fields.length === 0) continue

      const reference = this.getField(fields, headerIndex, ['reference'])
      if (!reference) continue

      const stockRaw = this.getField(fields, headerIndex, ['stock_initial'])
      const stockInitial = this.parseNumberFr(stockRaw)
      if (stockInitial < 0) throw new Error(`Ligne ${i + 1}: le stock_initial doit être un montant positif ("${stockRaw}")`);
      if (!Number.isInteger(stockInitial)) {
        throw new Error(`Ligne ${i + 1}: le stock_initial doit être un entier ("${stockRaw}")`)
      }

      const prixRaw = this.getField(fields, headerIndex, ['prix_vente_ttc'])
      const prixVenteTtc = prixRaw ? this.parseNumberFr(prixRaw) : undefined
      if (prixVenteTtc !== undefined && prixVenteTtc < 0) {
        throw new Error(`Ligne ${i + 1}: le prix de vente doit être un montant positif ("${prixRaw}")`);
      }

      rows.push({
        reference: reference.trim(),
        specificite: this.getField(fields, headerIndex, ['specificité']).trim() || undefined,
        karazany: this.getField(fields, headerIndex, ['karazany']).trim() || undefined,
        stockInitial,
        prixVenteTtc,
      })
    }

    return rows
  }

  /**
   * Parse la Fiche Commande.
   * Format: date, nom, email, pwd, adresse, achat, etat
   */
  parseOrderRowsFromCSV(fileText: string): CsvOrderRow[] {
    const lines = this.getLines(fileText);
    if (lines.length <= 1) return []
    const delimiter = this.detectDelimiter(lines[0])
    const headerFields = this.parseDelimitedLine(lines[0], delimiter)

    // Validation des colonnes
    this.validateColumns(headerFields, [
      'date', 'nom', 'email', 'pwd', 'adresse', 'achat', ['etat', 'état', 'status', 'state']
    ], 'Fiche Commande');

    const headerIndex = this.buildHeaderIndex(headerFields)
    const rows: CsvOrderRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseOrderFields(lines[i], headerFields.length, delimiter)
      if (fields.length === 0) continue

      const dateRaw = this.getField(fields, headerIndex, ['date'])
      if (!dateRaw) {
        throw new Error(`Ligne ${i + 1}: date manquante`)
      }
      if (!this.checkDateFormat(dateRaw)) {
        throw new Error(`Ligne ${i + 1}: format de date différente de DD/MM/YYYY ("${dateRaw}")`)
      }
      const date = this.parseDateFr(dateRaw)
      if (!date) {
        throw new Error(`Ligne ${i + 1}: date invalide ("${dateRaw}")`)
      }

      const email = this.getField(fields, headerIndex, ['email'])
      if (!email) continue

      rows.push({
        date,
        name: this.getField(fields, headerIndex, ['nom']),
        email,
        pwd: this.getField(fields, headerIndex, ['pwd']),
        adresse: this.getField(fields, headerIndex, ['adresse']),
        achat: this.getField(fields, headerIndex, ['achat']),
        etat: normalizeOrderEtat(this.getField(fields, headerIndex, ['etat', 'état', 'status', 'state'])),
      })
    }

    return rows
  }

  private detectDelimiter(line: string): string {
    // Heuristic: choose the delimiter from common candidates that occurs most often outside quotes
    const candidates = [',', ';', '\t', '|']
    const counts: Record<string, number> = {}

    for (const d of candidates) counts[d] = 0

    let insideQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        // handle escaped quotes
        if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') { i++; continue }
        insideQuotes = !insideQuotes
        continue
      }
      if (!insideQuotes && candidates.includes(ch)) counts[ch] = (counts[ch] || 0) + 1
    }

    // pick highest count, fallback to comma
    let best = ','
    let bestCount = counts[best] || 0
    for (const d of candidates) {
      if ((counts[d] || 0) > bestCount) {
        best = d
        bestCount = counts[d]
      }
    }
    return best
  }

  private getLines(fileText: string): string[] {
    // Remove UTF-8 BOM if present, normalize newlines and trim empty lines
    const text = fileText.replace(/^\uFEFF/, '')
      .replace(/\u0000/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    return text
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0)
  }

  private buildHeaderIndex(headerFields: string[]): Record<string, number> {
    const idx: Record<string, number> = {}
    headerFields.forEach((raw, i) => {
      const key = this.normalizeHeaderKey(raw)
      if (key) idx[key] = i
    })
    return idx
  }

  private getField(fields: string[], headerIndex: Record<string, number>, keys: string[]): string {
    for (const k of keys) {
      const ix = headerIndex[this.normalizeHeaderKey(k)]
      if (ix !== undefined) return (fields[ix] ?? '').trim()
    }
    return ''
  }

  /**
   * Parse une ligne (CSV/TSV) en tenant compte des guillemets.
   */
  private parseDelimitedLine(line: string, delimiter: string): string[] {
    const fields: string[] = []
    let current = ''
    let insideQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        // If we're inside quotes and the next char is also a quote, it's an escaped quote -> append one quote and skip next
        if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
          continue
        }
        // Toggle quote state
        insideQuotes = !insideQuotes
        continue
      }

      if (char === delimiter && !insideQuotes) {
        fields.push(current.trim())
        current = ''
        continue
      }

      current += char
    }

    fields.push(current.trim())
    return fields
  }

  private parseOrderFields(line: string, expectedFieldCount: number, delimiter: string): string[] {
    let rawFields = this.parseDelimitedLine(line, delimiter)
    if (rawFields.length === 1) {
      const unwrappedLine = this.unwrapWholeRowQuotes(line)
      if (unwrappedLine !== line) {
        rawFields = this.parseDelimitedLine(unwrappedLine, delimiter)
      }
    }
    if (rawFields.length <= expectedFieldCount) {
      return rawFields.map((field) => this.cleanCsvField(field))
    }

    const cleaned = rawFields.map((field) => this.cleanCsvField(field))

    if (expectedFieldCount < 7) {
      return cleaned
    }

    const date = cleaned[0] ?? ''
    const name = cleaned[1] ?? ''
    const email = cleaned[2] ?? ''
    const pwd = cleaned[3] ?? ''
    const tail = cleaned.slice(4, -1)
    const etat = cleaned[cleaned.length - 1] ?? ''

    if (tail.length <= 1) {
      return [date, name, email, pwd, tail[0] ?? '', '', etat]
    }

    const purchaseStart = tail.findIndex((value) => this.looksLikePurchaseChunk(value))
    if (purchaseStart >= 0) {
      return [
        date,
        name,
        email,
        pwd,
        tail.slice(0, purchaseStart).join(delimiter).trim(),
        tail.slice(purchaseStart).join(delimiter).trim(),
        etat,
      ]
    }

    return [
      date,
      name,
      email,
      pwd,
      tail[0] ?? '',
      tail.slice(1).join(delimiter).trim(),
      etat,
    ]
  }

  private cleanCsvField(value: string): string {
    const trimmed = value.trim()
    return trimmed
      .replace(/^"+/, '')
      .replace(/"+$/, '')
      .replace(/^'+/, '')
      .replace(/'+$/, '')
      .trim()
  }

  private unwrapWholeRowQuotes(line: string): string {
    const trimmed = line.trim()
    if (trimmed.length < 2) return line
    if (trimmed[0] !== '"' || trimmed[trimmed.length - 1] !== '"') return line

    const inner = trimmed.slice(1, -1)
    if (!inner.includes(',')) return line

    return inner
  }

  private looksLikePurchaseChunk(value: string): boolean {
    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return /[\(\[]/.test(normalized) || /[a-z0-9]+_[a-z0-9]+/.test(normalized) || /;/.test(normalized)
  }

  private parseNumberFr(raw: string): number {
    if (!raw) return 0
    const cleaned = raw
      .trim()
      .replace(/\s+/g, '')
      .replace(/%/g, '')
      .replace(/,/g, '.')

    const num = Number.parseFloat(cleaned)
    return Number.isFinite(num) ? num : 0
  }

  private parsePercentFr(raw: string): number {
    if (!raw) return 0
    return this.parseNumberFr(raw)
  }

  private parseDateFr(raw: string): Date | undefined {
    const cleaned = raw.trim()
    const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) return undefined
    const day = Number(m[1])
    const month = Number(m[2])
    const year = Number(m[3])
    if (!day || !month || !year) return undefined
    return new Date(year, month - 1, day)
  }
}
