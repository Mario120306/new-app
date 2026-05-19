/**
 * Service pour extraire et gérer les images depuis un ZIP
 * Utilise JSZip pour l'extraction
 */
export class ZipImageService {
  /**
   * Extrait les fichiers images d'un ZIP
   * @param zipFile Fichier ZIP
   * @returns Array de {filename, blob, productId}
   */
  async extractImagesFromZip(zipFile: File): Promise<Array<{ filename: string; blob: Blob; productId?: number }>> {
    try {
      // Dynamique import pour éviter dépendance si pas utilisé
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const loaded = await zip.loadAsync(zipFile)

      const images: Array<{ filename: string; blob: Blob; productId?: number }> = []
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

      for (const [path, file] of Object.entries(loaded.files)) {
        if (file.dir) continue

        const filename = path.split('/').pop() || path
        if (filename.startsWith('._')) continue

        const isImage = imageExtensions.some((ext) => path.toLowerCase().endsWith(ext))
        if (!isImage) continue

        const blob = await file.async('blob')

        // Essayer d'extraire l'ID du produit du chemin (ex: "123/image.jpg" ou "product_123.jpg")
        const productIdMatch = path.match(/(\d+)[/\\]|product[_-]?(\d+)/)
        const productId = productIdMatch ? parseInt(productIdMatch[1] || productIdMatch[2], 10) : undefined

        images.push({ filename, blob, productId })
      }

      return images
    } catch (err) {
      throw new Error(`Erreur extraction ZIP: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Upload une image vers PrestaShop API
   * @param productId ID du produit
   * @param imageBlob Blob de l'image
   * @param wsKey Clé WebService
   * @returns {ok, message}
   */
    async uploadImageToProduct(
    productId: number,
    imageBlob: Blob,
    wsKey: string
        ): Promise<{ ok: boolean; message: string }> {
        try {
            const base = (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api')
            .replace(/\/$/, '')

            // ✅ URL CORRECTE
            const url = `${base}/images/products/${productId}`

            const formData = new FormData()

            // ✅ nom obligatoire = image
            formData.append('image', imageBlob, 'product.jpg')

            const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + btoa(wsKey + ':'),
            },
            body: formData,
            })

            const text = await response.text()

            if (response.ok) {
            return {
                ok: true,
                message: `Produit ${productId}: image uploadée`,
            }
            } else {
            return {
                ok: false,
                message: `Produit ${productId}: erreur upload (${response.status}) - ${text}`,
            }
            }
        } catch (err) {
            return {
            ok: false,
            message: `Produit ${productId}: ${
                err instanceof Error ? err.message : String(err)
            }`,
            }
        }
    }
}
