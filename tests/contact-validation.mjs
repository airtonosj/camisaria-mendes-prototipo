import assert from 'node:assert/strict';
import { normalizeCustomerEmail, parseWhatsapp } from '../shared/contact.mjs';
import { canonicalWhatsapp } from '../api/phone.mjs';

for (const value of ['(98) 98778-0960', '+55 98 98778-0960', '98987780960', '098987780960']) {
  assert.equal(parseWhatsapp(value).canonical, '5598987780960', value);
  assert.equal(canonicalWhatsapp(value), '5598987780960');
}
assert.equal(parseWhatsapp('55999991234').canonical, '5555999991234', 'DDD 55 não pode ser confundido com país');
assert.equal(parseWhatsapp('9832221234').canonical, '559832221234');
for (const value of ['', '123', '00999999999999999', '20999991234', '9887778096', '98877780960', 'abc98987780960', '+1 98 98778-0960', '98+987780960']) {
  assert.ok(parseWhatsapp(value).error, value);
}
for (const value of ['nome@dominio.com', 'nome.sobrenome+turma@dominio.com.br', ' Nome@Dominio.COM ']) {
  assert.equal(normalizeCustomerEmail(value), value.trim().toLowerCase());
}
for (const value of ['', 'nome@dominio', 'nome@@dominio.com', '.nome@dominio.com', 'nome..a@dominio.com', 'nome@-dominio.com', 'nome@dominio..com', 'nome @dominio.com', 'a'.repeat(65) + '@dominio.com']) {
  assert.equal(normalizeCustomerEmail(value), '', value);
}
console.log('Validações de contato: OK');
