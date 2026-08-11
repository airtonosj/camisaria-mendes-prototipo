import { pool } from "./database.mjs";
import { hashPassword, normalizeEmail } from "./auth.mjs";

/**
 * Cadastro inicial da camisaria. Roda uma vez, logo depois das migrações, e cria a
 * conta com senha provisória marcada para troca obrigatória no primeiro acesso.
 *
 * É idempotente por segurança: se a conta já existe, o script não toca na senha.
 * Para redefinir de propósito, passe `--force`.
 */

const force = process.argv.includes("--force");
const name = process.env.ADMIN_INITIAL_NAME?.trim() || "Gustavo Mendes";
const email = normalizeEmail(process.env.ADMIN_INITIAL_EMAIL || "gustavo@mendes");
const password = process.env.ADMIN_INITIAL_PASSWORD || "";

if (!email) {
  console.error("ADMIN_INITIAL_EMAIL inválido.");
  process.exit(1);
}
if (!password) {
  console.error("ADMIN_INITIAL_PASSWORD precisa ser informada explicitamente.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_INITIAL_PASSWORD precisa ter ao menos 8 caracteres.");
  process.exit(1);
}

try {
  const [existing] = await pool.execute("SELECT id, active FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length > 0 && !force) {
    console.log(`A conta ${email} já existe. Nada foi alterado.`);
    console.log("Para redefinir a senha provisória mesmo assim, rode: npm run user:admin -- --force");
  } else {
    await pool.execute(
      `INSERT INTO users (name, email, password_hash, role, must_change_password) VALUES (?, ?, ?, 'camisaria', TRUE)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash),
         role = VALUES(role), must_change_password = TRUE, active = TRUE`,
      [name, email, hashPassword(password)],
    );
    await pool.execute(
      "DELETE FROM staff_sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)",
      [email],
    );
    console.log(`Conta da camisaria pronta: ${email}`);
    console.log("Senha provisória armazenada com hash e omitida dos logs.");
    console.log("O painel vai exigir a troca da senha no primeiro acesso; depois remova ADMIN_INITIAL_PASSWORD do ambiente.");
  }
} finally {
  await pool.end();
}
