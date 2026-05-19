import { useState } from 'react'
import { CSVImportService } from '../../service/CSVImportService'
import { ZipImageService } from '../../service/ZipImageService'
import { ImportService } from '../../service/ImportService'
import { Product } from '../../entities/Product'

export default function ImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [stockFile, setStockFile] = useState<File | null>(null)
  const [stockText, setStockText] = useState('')
  const [commandeFile, setCommandeFile] = useState<File | null>(null)
  const [commandeText, setCommandeText] = useState('')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const csvService = new CSVImportService()
  const zipService = new ZipImageService()
  const importService = new ImportService()

  async function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setCsvFile(file)
      try {
        setCsvText(await readFileTextAuto(file))
      } catch {
        setCsvFile(null)
        setCsvText('')
        setStatus('Impossible de lire le fichier CSV sélectionné')
      }
    } else {
      setCsvFile(null)
      setCsvText('')
      setStatus(file ? 'Sélectionnez un fichier CSV valide' : '')
    }
  }

  function handleZipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && (file.type === 'application/zip' || file.name.endsWith('.zip'))) {
      setZipFile(file)
    } else {
      setZipFile(null)
      setStatus(file ? 'Sélectionnez un fichier ZIP valide' : '')
    }
  }

  async function handleStockFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setStockFile(file)
      try {
        setStockText(await readFileTextAuto(file))
      } catch {
        setStockFile(null)
        setStockText('')
        setStatus('Impossible de lire le fichier stock sélectionné')
      }
    } else {
      setStockFile(null)
      setStockText('')
      setStatus(file ? 'Sélectionnez un fichier CSV valide' : '')
    }
  }

  async function handleCommandeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setCommandeFile(file)
      try {
        setCommandeText(await readFileTextAuto(file))
      } catch {
        setCommandeFile(null)
        setCommandeText('')
        setStatus('Impossible de lire le fichier commande sélectionné')
      }
    } else {
      setCommandeFile(null)
      setCommandeText('')
      setStatus(file ? 'Sélectionnez un fichier CSV valide' : '')
    }
  }

  const canImport = !isLoading && csvFile

  async function readFileTextAuto(file: File): Promise<string> {
    // Try UTF-8, fallback to UTF-16 (Excel), then windows-1252 for mojibake.
    const buffer = await file.arrayBuffer()
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)

    // Common with Excel-exported CSV: UTF-16 text decoded as UTF-8 contains many NUL chars.
    if (utf8.includes('\u0000')) {
      try {
        const utf16le = new TextDecoder('utf-16le').decode(buffer)
        if (utf16le && !utf16le.includes('\u0000')) return utf16le
      } catch {
        // ignore and continue fallbacks
      }
      try {
        const utf16be = new TextDecoder('utf-16be').decode(buffer)
        if (utf16be && !utf16be.includes('\u0000')) return utf16be
      } catch {
        // ignore and continue fallbacks
      }
    }

    // Heuristic: presence of common mojibake sequences like Ã©, Ã', etc.
    if (/Ã\w/.test(utf8) || /Ã©/.test(utf8) || utf8.includes('�')) {
      try {
        // @ts-ignore - TextDecoder supports windows-1252 in modern browsers
        const win = new TextDecoder('windows-1252').decode(buffer)
        return win
      } catch {
        return utf8
      }
    }

    return utf8
  }

  async function handleImport() {
    if (!csvFile) {
      setStatus('Sélectionnez au minimum le fichier "Fiche produit" (CSV)')
      return
    }

    setIsLoading(true)
    setLogs([])
    const nextLogs: string[] = []
    let createdProductIds: number[] = []

    try {
      nextLogs.push(' Début de l\'importation globale...')
      nextLogs.push('')

      // ── Étape 1: Fiche produit ──────────────────────────────────────
      nextLogs.push(' Étape 1: Traitement de la Fiche produit...')
      const productCsvText = csvText || await readFileTextAuto(csvFile)
      const rows = csvService.parseCatalogRowsFromCSV(productCsvText)
      nextLogs.push(`✓ ${rows.length} lignes produits validées`)

      nextLogs.push(' Envoi des produits vers PrestaShop...')
      const result = await importService.importCatalogRows(rows)
      
      createdProductIds = Object.values(result.createdByReference)
      
      nextLogs.push(` ${result.success} produits créés/mis à jour`)
      if (result.failed > 0) {
        for (const log of result.logs) nextLogs.push(`  ${log}`)
        throw new Error(`Échec de création pour ${result.failed} produit(s). Annulation...`)
      }
      for (const log of result.logs) {
        nextLogs.push(`  ${log}`)
      }
      nextLogs.push('')

      // ── Étape 2: Images produits (optionnel) ─────────────────────────
      if (zipFile) {
        nextLogs.push('Étape 2: Traitement des Images produits (ZIP)...')
        const images = await zipService.extractImagesFromZip(zipFile)
        nextLogs.push(`✓ ${images.length} images extraites du ZIP`)

        nextLogs.push('Upload des images...')
        let imgSuccess = 0
        let imgFailed = 0
        const mere = new Product()
        const wsKey = mere.getWsKey()

        for (const img of images) {
          let productId = img.productId
          if (!productId) {
            const base = img.filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
            productId = result.createdByReference[base] || result.createdByReference[base.toLowerCase()]
            if (!productId) {
              productId = await importService.findProductIdByReference(base, wsKey)
            }
          }

          if (!productId) {
            nextLogs.push(`${img.filename}: Référence produit introuvable dans la base`)
            imgFailed++
            continue
          }

          const resultImg = await zipService.uploadImageToProduct(productId, img.blob, wsKey)
          if (resultImg.ok) {
            imgSuccess++
          } else {
            imgFailed++
            nextLogs.push(`${img.filename}: ${resultImg.message}`)
          }
        }
        if (imgFailed > 0) {
          throw new Error(`Échec de l'upload pour ${imgFailed} image(s). Annulation...`)
        }
        nextLogs.push(`${imgSuccess} images liées avec succès`)
        nextLogs.push('')
      } else {
        nextLogs.push(' Étape 2: Images produits (ZIP) ignorées (aucun fichier fourni).')
        nextLogs.push('')
      }

      // ── Étape 3: Fiche stock ────────────────────────────────────────
      if (stockFile) {
        nextLogs.push('Étape 3: Traitement de la Fiche stock...')
        try {
          const currentStockText = stockText || await readFileTextAuto(stockFile)
          const stockRows = csvService.parseStockRowsFromCSV(currentStockText)
          nextLogs.push(` ${stockRows.length} lignes de stock validées`)

          const stockResult = await importService.importStockRows(stockRows, result.createdByReference)
          nextLogs.push(` ${stockResult.success} mises à jour de stock effectuées`)
          if (stockResult.failed > 0) {
            for (const log of stockResult.logs) nextLogs.push(`    ${log}`)
            throw new Error(`Échec de la mise à jour pour ${stockResult.failed} stock(s). Annulation...`)
          }
          for (const log of stockResult.logs) {
            nextLogs.push(`    ${log}`)
          }
        } catch (err) {
          throw new Error(`Erreur Fiche stock: ${err instanceof Error ? err.message : String(err)}`)
        }
        nextLogs.push('')
      }

      // ── Étape 4: Fiche commande ─────────────────────────────────────
      if (commandeFile) {
        nextLogs.push('Étape 4: Traitement de la Fiche commande...')
        try {
          const currentCommandeText = commandeText || await readFileTextAuto(commandeFile)
          const orderRows = csvService.parseOrderRowsFromCSV(currentCommandeText)
          nextLogs.push(`✓ ${orderRows.length} lignes de commandes validées`)

          const orderResult = await importService.importOrderRows(orderRows, result.createdByReference)
          nextLogs.push(`${orderResult.success} commandes générées`)
          if (orderResult.failed > 0) {
            for (const log of orderResult.logs) nextLogs.push(`    ${log}`)
            throw new Error(`Échec de la génération pour ${orderResult.failed} commande(s). Annulation...`)
          }
          for (const log of orderResult.logs) {
            nextLogs.push(`    ${log}`)
          }
        } catch (err) {
          throw new Error(`Erreur Fiche commande: ${err instanceof Error ? err.message : String(err)}`)
        }
        nextLogs.push('')
      }

      nextLogs.push(' Importation terminée avec succès !')
      setStatus(`✓ Opération terminée avec succès.`)
    } catch (err) {
      nextLogs.push(` ERREUR CRITIQUE: ${err instanceof Error ? err.message : String(err)}`)
      
      if (createdProductIds.length > 0) {
        nextLogs.push(` ROLLBACK: Suppression des produits créés pour annuler l'import...`)
        const mere = new Product()
        const wsKey = mere.getWsKey()
        const safeDeleteProduct = typeof importService.deleteProduct === 'function'
          ? (id: number) => importService.deleteProduct(id, wsKey)
          : async (id: number) => {
            try {
              const response = await fetch(`/prestashop/api/products/${id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: 'Basic ' + btoa(wsKey + ':'),
                },
              })
              return response.ok
            } catch {
              return false
            }
          }
        let rollbackSuccess = 0
        let rollbackFailed = 0
        const uniqueIds = Array.from(new Set(createdProductIds))
        for (const id of uniqueIds) {
          const deleted = await safeDeleteProduct(id)
          if (deleted) rollbackSuccess++
          else rollbackFailed++
        }
        nextLogs.push(`ROLLBACK TERMINÉ: ${rollbackSuccess} produit(s) supprimé(s). ${rollbackFailed > 0 ? `(${rollbackFailed} échec)` : ''}`)
      }

      setStatus('Échec de l\'importation : voir les logs ci-dessous')
    } finally {
      setLogs(nextLogs)
      setIsLoading(false)
    }
  }

  // ── UI Styles ──────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    padding: 28,
    borderRadius: 12,
    background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.08) 0%, rgba(155, 231, 168, 0.05) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    marginBottom: 20,
  }

  function fileInputStyle(hasFile: boolean): React.CSSProperties {
    return {
      padding: 14,
      borderRadius: 8,
      border: hasFile ? '2px solid #9be7a8' : '2px dashed rgba(255, 255, 255, 0.2)',
      background: 'rgba(0, 0, 0, 0.2)',
      color: '#fff',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      opacity: isLoading ? 0.5 : 1,
      transition: 'all 0.3s ease',
      fontSize: 14,
    }
  }

  function fileLabel(label: string, badge?: string) {
    return (
      <label style={{ display: 'block', marginBottom: 14, fontSize: 15, fontWeight: 600, color: '#fff' }}>
        {label}
        {badge && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'rgba(255,255,255,0.08)',
              color: '#aaa',
              verticalAlign: 'middle',
            }}
          >
            {badge}
          </span>
        )}
      </label>
    )
  }

  function fileBadge(file: File) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: '#9be7a8', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>✓</span>
        <span>{file.name}</span>
      </div>
    )
  }

  return (
    <section style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div
        style={{
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        Outils Back-office
      </div>
      <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 36, fontWeight: 700 }}>Importation de Données</h1>
      <p style={{ color: '#aaa', marginBottom: 32, fontSize: 15, lineHeight: 1.6 }}>
        Veuillez sélectionner vos fichiers pour mettre à jour le catalogue PrestaShop.
      </p>

      {/* ── Bloc : Fichiers import ── */}
      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#4a90e2', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Fichier Requis
      </div>
      <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          {fileLabel('Fiche produit', 'CSV')}
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvFileChange}
            disabled={isLoading}
            style={fileInputStyle(!!csvFile)}
          />
          {csvFile && fileBadge(csvFile)}
        </div>

        <div>
          {fileLabel('Images produits', 'ZIP (optionnel)')}
          <input
            type="file"
            accept=".zip"
            onChange={handleZipFileChange}
            disabled={isLoading}
            style={fileInputStyle(!!zipFile)}
          />
          {zipFile && fileBadge(zipFile)}
        </div>
        <div>
          {fileLabel('Fiche stock', 'CSV (optionnel)')}
          <input
            type="file"
            accept=".csv"
            onChange={handleStockFileChange}
            disabled={isLoading}
            style={fileInputStyle(!!stockFile)}
          />
          {stockFile ? fileBadge(stockFile) : <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>Aucun fichier sélectionné</div>}
        </div>

        <div>
          {fileLabel('Fiche commande', 'CSV (optionnel)')}
          <input
            type="file"
            accept=".csv"
            onChange={handleCommandeFileChange}
            disabled={isLoading}
            style={fileInputStyle(!!commandeFile)}
          />
          {commandeFile ? fileBadge(commandeFile) : <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>Aucun fichier sélectionné</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={handleImport}
        disabled={!canImport}
        style={{
          width: '100%',
          padding: 18,
          borderRadius: 12,
          background: canImport
            ? 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)'
            : 'rgba(255, 255, 255, 0.1)',
          color: canImport ? 'white' : '#666',
          border: 'none',
          fontSize: 16,
          fontWeight: 700,
          cursor: canImport ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          boxShadow: canImport ? '0 10px 20px rgba(74, 144, 226, 0.2)' : 'none',
        }}
      >
        {isLoading ? 'Importation en cours...' : 'Lancer l\'importation'}
      </button>

      {/* ── Feedback ── */}
      {status && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 10,
            background: status.includes('✓') ? 'rgba(155, 231, 168, 0.1)' : 'rgba(255, 107, 107, 0.1)',
            color: status.includes('✓') ? '#9be7a8' : '#ff6b6b',
            border: `1px solid ${status.includes('✓') ? 'rgba(155, 231, 168, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {status}
        </div>
      )}

      {/* ── Console de Logs ── */}
      {logs.length > 0 && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 10,
            background: '#0a0c10',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxHeight: 400,
            overflow: 'auto',
            fontFamily: 'Consolas, monaco, monospace',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                color: log.includes('❌') || log.includes('🛑')
                  ? '#ff6b6b'
                  : log.includes('✅') || log.includes('✓')
                    ? '#9be7a8'
                    : log.includes('⚠️')
                      ? '#ffa500'
                      : '#bbb',
                marginBottom: 4,
              }}
            >
              {log || <br />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}