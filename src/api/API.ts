import { Mere } from '../entities/Mere'
import type { BaseService } from '../service/BaseService'
import { ApiError } from '../utils/ApiError'

export class API {
  private parser = new DOMParser()
  private readonly baseUrl = (import.meta.env.VITE_PRESTASHOP_API_BASE_URL || '/prestashop/api').replace(/\/$/, '')

  public async fetch<T>(
    {
      method,
      mere,
      service,
      apresDefaultURL,
      params,
      body,
    } : {method: string, mere: Mere, service: BaseService<T>, apresDefaultURL?: string, params?: URLSearchParams, body?: string}
  ): Promise<T[]> {

    this.validParams(method, apresDefaultURL, params, body)

    const resource = mere.getResourcePlural()
    const base = `${this.baseUrl}/${resource}`
    const url = params ? `${base}?${params.toString()}` : `${base}${apresDefaultURL ? apresDefaultURL : ''}`

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': 'Basic ' + btoa(mere.getWsKey() + ':'),
      },
      body,
    })

    const xmlText = await response.text()
    const document = this.parser.parseFromString(xmlText, 'text/xml')

    const parserErrors = document.getElementsByTagName('parsererror')
    if (parserErrors.length > 0) {
      const parserMessage = parserErrors[0]?.textContent || 'Invalid XML response received from PrestaShop'
      throw new ApiError(parserMessage, 'XML Parse Error', response.status || 500)
    }

    if (!response.ok) {
      const errorNode = document.getElementsByTagName('error')
      let message = ''
      if (errorNode.length > 0) message = document.getElementsByTagName('message')[0]?.textContent || ''
      throw new ApiError(message, response.statusText, response.status)
    }

    // Log the raw XML response for debugging
    // eslint-disable-next-line no-console
    console.log(`[API] Resource: ${resource}, Response length: ${xmlText.length} chars`)
    // eslint-disable-next-line no-console
    console.log(`[API] Raw XML (first 500 chars):`, xmlText.substring(0, 500))
    // eslint-disable-next-line no-console
    console.log(`[API] Full XML:`, xmlText)

    // Service is responsible for converting XML Document into array of T
    const result = service.createListBy(document)
    // eslint-disable-next-line no-console
    console.log(`[API] Parsed result (${resource}):`, result)
    return result
  }

  private validParams(method: string, apresDefaultURL?: string, params?: URLSearchParams, body?: string) {
    const m = method.toUpperCase()
    if (m === 'GET') {
      // GET: no body and no apresDefaultURL allowed; params optional
      if (body || apresDefaultURL) throw new ApiError('Method GET, ne doit pas avoir BODY ni apresDefaultURL', 'API ERROR', 800)
      return
    } else if (m === 'DELETE') {
      if (!apresDefaultURL || params || body) throw new ApiError('Method DELETE, utiliser apresDefaultURL', 'API ERROR: ne doit pas avoir d\'objet PARAMS ni BODY', 800)
      return
    } else if (m === 'POST' || m === 'PATCH') {
      if (!body || params || apresDefaultURL) throw new ApiError('Method ' + m + ', utilise BODY!!!', 'API ERROR: ne doit pas avoir d\'objet PARAMS ni apresDefaultURL', 800)
      return
    }

    throw new ApiError('Method INVALID: ' + method, 'API ERROR', 800)
  }
}
