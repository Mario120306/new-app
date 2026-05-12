import { Mere } from './Mere';
import { simpleMD5 } from '../utils/crypto';

export class Customer extends Mere {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  address: string;
  date_add: string;

  constructor(
    id: number = 0,
    firstname: string = '',
    lastname: string = '',
    email: string = '',
    password: string = '',
    address: string = '',
    date_add: string = new Date().toISOString()
  ) {
    super('TVZU9X3GKQAMMDWVVI7MSWRV2EAWTV8D', 'customers', 'customer');
    this.id = id;
    this.firstname = firstname;
    this.lastname = lastname;
    this.email = email;
    this.password = password;
    this.address = address;
    this.date_add = date_add;
  }

  getResourcePlural(): string {
    return 'customers';
  }

  getResourceSingular(): string {
    return 'customer';
  }

  getCreateXML(): string {
    const md5Password = simpleMD5(this.password);

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <customer>
    <id_default_group>3</id_default_group>
    <id_lang>1</id_lang>
    <firstname>${this.firstname}</firstname>
    <lastname>${this.lastname}</lastname>
    <email>${this.email}</email>
    <passwd>${md5Password}</passwd>
    <last_passwd_gen>2026-05-12 00:00:00</last_passwd_gen>
    <active>1</active>
    <date_add>${this.date_add}</date_add>
    <date_upd>2026-05-12 00:00:00</date_upd>
    <note></note>
    <is_guest>0</is_guest>
    <newsletter>0</newsletter>
    <ip_registration_address></ip_registration_address>
    <addresses>
      <address>
        <id></id>
        <firstname>${this.firstname}</firstname>
        <lastname>${this.lastname}</lastname>
        <company></company>
        <address1>${this.address}</address1>
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
