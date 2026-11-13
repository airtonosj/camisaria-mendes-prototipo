export { parseWhatsapp } from './phone.mjs';

// Contatos de clientes precisam de um domínio público completo. O login interno
// mantém sua regra própria para não invalidar contas já existentes.
export function normalizeCustomerEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '';
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return '';
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-z]{2,63}$/i.test(labels.at(-1))) return '';
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return '';
  return email;
}
