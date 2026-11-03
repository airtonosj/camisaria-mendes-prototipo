import { config } from "./config.mjs";
import { pool } from "./database.mjs";
import { createPasswordResetToken, findActiveUserByEmail, normalizeEmail } from "./auth.mjs";

/**
 * Gera manualmente um link de redefinição de senha. É a saída para quando o SMTP
 * não está configurado ou o e-mail da conta não recebe mensagens: quem administra o
 * servidor gera o link e o entrega pelo canal que já usa com a camisaria.
 *
 * O link vale uma hora e só pode ser usado uma vez, igual ao enviado por e-mail.
 */

const email = normalizeEmail(process.argv[2]);
if (!email) {
  console.error('Uso: npm run user:reset -- email@dominio.com');
  process.exit(1);
}

try {
  const user = await findActiveUserByEmail(email);
  if (!user) {
    console.error(`Nenhuma conta ativa com o e-mail ${email}.`);
    process.exitCode = 1;
  } else {
    const { token, expiresAt } = await createPasswordResetToken(user.id, "cli");
    console.log(`Link de redefinição para ${user.name} <${user.email}>:`);
    console.log(`${config.publicAppUrl}/?rota=redefinir-senha&token=${encodeURIComponent(token)}`);
    console.log(`Válido até ${expiresAt.toISOString()} e apenas uma vez.`);
  }
} finally {
  await pool.end();
}
