export class ApiError extends Error {
  public statusText: string
  public status: number

  constructor(message: string, statusText = '', status = 0) {
    super(message)
    this.name = 'ApiError'
    this.statusText = statusText
    this.status = status
  }
}
