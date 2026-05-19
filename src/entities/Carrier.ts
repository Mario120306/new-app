import { Mere } from './Mere';

export class Carrier extends Mere {
  id: number;
  name: string;
  active: boolean;
  delay: string;

  constructor(
    id: number = 0,
    name: string = '',
    active: boolean = true,
    delay: string = ''
  ) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'carriers', 'carrier');
    this.id = id;
    this.name = name;
    this.active = active;
    this.delay = delay;
  }

  getResourcePlural(): string {
    return 'carriers';
  }

  getResourceSingular(): string {
    return 'carrier';
  }
}
