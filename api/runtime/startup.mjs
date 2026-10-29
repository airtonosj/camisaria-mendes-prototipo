import { config, productionConfigurationErrors } from '../config.mjs';
import { pool } from '../database.mjs';
import { mailerConfigured } from '../mailer.mjs';
import { getLicenseState, licenseConfigurationErrors } from '../license-control.mjs';
import { ApiError } from '../http/response.mjs';
import { databaseReadiness, storageReadiness } from './readiness.mjs';

/**
 * Conferências de inicialização. Nenhuma delas impede a API de subir: elas existem
 * para que um deploy com senha de fábrica ou usuário de demonstração
 * apareça no log em vez de passar despercebido.
 */
export async function reportStartupChecks() {
  const warnings = [];
  if (!config.payments.infinitePay.handle) {
    warnings.push("INFINITEPAY_HANDLE não configurada: o checkout ainda não pode identificar a conta da camisaria.");
  }
  if (!config.payments.infinitePay.checkoutEnabled) {
    warnings.push("Checkout InfinitePay desabilitado até a homologação real de checkout, webhook e payment_check.");
  }
  if (config.isProduction && /^https?:\/\/(127\.0\.0\.1|localhost)/.test(config.publicAppUrl)) {
    warnings.push("PUBLIC_APP_URL aponta para o próprio servidor. O link de redefinição de senha não vai funcionar.");
  }
  if (!mailerConfigured()) {
    warnings.push("SMTP não configurado: recuperação de senha e confirmações de pagamento por e-mail ficam indisponíveis.");
  }

  try {
    await databaseReadiness();
    await storageReadiness();
    const license = await getLicenseState({ fresh: true });
    if (license.enabled) console.log(`Controle de licença habilitado; estado atual: ${license.status}.`);
  } catch (error) {
    warnings.push(error instanceof ApiError ? error.message : "Não foi possível conferir banco/armazenamento.");
  }

  try {
    const [demoUsers] = await pool.execute(
      "SELECT id FROM users WHERE email IN ('admin@teste.com') AND active = TRUE",
    );
    if (demoUsers.length) warnings.push("Há usuário de demonstração ativo. Desative-o antes de publicar.");
    const [pending] = await pool.execute("SELECT email FROM users WHERE must_change_password = TRUE AND active = TRUE");
    if (pending.length) console.log(`Aviso: ${pending.length} conta(s) precisam trocar a senha provisória.`);
  } catch (error) {
    console.warn("Não foi possível conferir os usuários no boot:", { code: error.code ?? "STARTUP_ERROR" });
  }

  for (const warning of warnings) console.warn(`Atenção: ${warning}`);
}

export async function productionStartupErrors() {
  const errors = licenseConfigurationErrors();
  if (!config.isProduction) return errors;
  errors.push(...productionConfigurationErrors());
  if (errors.length > 0) return errors;
  try {
    await databaseReadiness();
    await storageReadiness();
    const [demoUsers] = await pool.execute(
      "SELECT email FROM users WHERE email = 'admin@teste.com' AND active = TRUE",
    );
    if (demoUsers.length > 0) errors.push("O usuário de demonstração admin@teste.com precisa ser desativado.");
    const [provisionalUsers] = await pool.execute(
      "SELECT email FROM users WHERE must_change_password = TRUE AND active = TRUE LIMIT 1",
    );
    if (provisionalUsers.length > 0) {
      errors.push("Há conta com senha provisória; é preciso trocá-la antes da produção.");
    }
  } catch (error) {
    errors.push(error instanceof ApiError ? error.message : "Pré-verificação operacional falhou.");
  }
  return errors;
}
