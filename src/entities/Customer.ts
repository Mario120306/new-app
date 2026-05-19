import { Mere } from './Mere';
import { simpleMD5 } from '../utils/crypto';
import { dateToString } from '../utils/DateFormatter';

export class Customer extends Mere {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  address: string;
  date_add: string;
  note: string;

  constructor(
    id: number = 0,
    firstname: string = '',
    lastname: string = '',
    email: string = '',
    password: string = '',
    address: string = '',
    date_add: string = new Date().toISOString(),
    note: string = ''
  ) {
    super('BZSMWP6E43Z8H41ACW75XU5XAQRAQG9B', 'customers', 'customer');
    this.id = id;
    this.firstname = firstname;
    this.lastname = lastname;
    this.email = email;
    this.password = password;
    this.address = address;
    this.date_add = date_add;
    this.note = note;
  }

  getResourcePlural(): string {
    return 'customers';
  }

  getResourceSingular(): string {
    return 'customer';
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  getCreateXML(): string {
    const md5Password = simpleMD5(this.password);
    const firstname = this.xmlEscape(this.firstname);
    const lastname = this.xmlEscape(this.lastname);
    const email = this.xmlEscape(this.email);
    const address = this.xmlEscape(this.address);
    const parsedDate = new Date(this.date_add || '')
    const dateAdd = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString().slice(0, 19).replace('T', ' ')
      : dateToString(parsedDate)

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <id_default_group>3</id_default_group>
    <id_lang>1</id_lang>
    <firstname>${firstname}</firstname>
    <lastname>${lastname}</lastname>
    <email>${email}</email>
    <passwd>${md5Password}</passwd>
    <last_passwd_gen>2026-05-12 00:00:00</last_passwd_gen>
    <active>1</active>
    <date_add>${dateAdd}</date_add>
    <date_upd>2026-05-12 00:00:00</date_upd>
    <note>${simpleMD5(this.password)}</note>
    <is_guest>0</is_guest>
    <newsletter>0</newsletter>
    <ip_registration_address></ip_registration_address>
    <addresses>
      <address>
        <id></id>
        <firstname>${firstname}</firstname>
        <lastname>${lastname}</lastname>
        <company></company>
        <address1>${address}</address1>
        <address2></address2>
        <city>Antananarivo</city>
        <postcode>101</postcode>
        <id_country>128</id_country>
        <id_state></id_state>
        <phone></phone>
        <phone_mobile></phone_mobile>
        <alias>Adresse par défaut</alias>
        <is_default>1</is_default>
      </address>
    </addresses>
  </customer>
</prestashop>`;
  }
}
