export class Mere {
  protected readonly wsKey: string
  protected readonly resourcePlural: string
  protected readonly resourceSingular: string

  constructor(wsKey: string, resourcePlural: string, resourceSingular: string) {
    this.wsKey = wsKey
    this.resourcePlural = resourcePlural
    this.resourceSingular = resourceSingular
  }

  getWsKey(): string {
    return this.wsKey
  }

  getResourcePlural(): string {
    return this.resourcePlural
  }

  getResourceSingular(): string {
    return this.resourceSingular
  }
}
