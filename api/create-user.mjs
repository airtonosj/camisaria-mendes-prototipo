import { pool } from "./database.mjs";
import { hashPassword, minimumPasswordLength, normalizeEmail } from "./auth.mjs";

const [name, rawEmail, password, role = "camisaria"] = process.argv.slice(2);
const email = normalizeEmail(rawEmail);

if (!name || !rawEmail || !password) {
  console.error("Uso: npm run user:create -- \"Nome Completo\" email@dominio.com senha [camisaria|representative]");
  process.exit(1);
}
if (!email) {
  console.error("Informe um e-mail válido.");
  process.exit(1);
}
if (password.length < minimumPasswordLength) {
  console.error(`A senha precisa ter ao menos ${minimumPasswordLength} caracteres.`);
  process.exit(1);
}
if (!["camisaria", "representative"].includes(role)) {
  console.error("O papel precisa ser camisaria ou representative.");
  process.exit(1);
}

try {
  await pool.execute(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), active = TRUE`,
    [name, email, hashPassword(password), role],
  );
  // Trocar a senha encerra as sessões abertas daquele usuário.
  await pool.execute(
    "DELETE FROM staff_sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)",
    [email],
  );
  console.log(`Usuário disponível: ${email} (${role})`);
} finally {
  await pool.end();
}
