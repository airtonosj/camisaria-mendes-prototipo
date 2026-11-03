import { randomUUID } from "node:crypto";
import { config } from "../api/config.mjs";
import { mailerConfigured, sendMail } from "../api/mailer.mjs";

const recipient = (process.argv[2] || process.env.SMTP_TEST_RECIPIENT || "").trim();
if (!mailerConfigured()) {
  throw new Error("Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD e SMTP_FROM antes do teste.");
}
if (!/^[^@\s]+@[^@\s]+$/.test(recipient)) {
  throw new Error("Informe o destinatário: npm run ops:email:test -- comprador@exemplo.com");
}

const id = randomUUID();
await sendMail({
  to: recipient,
  subject: "Teste SMTP - Camisaria Mendes",
  messageId: `smtp-test.${id}@notifications.camisaria-mendes`,
  text: [
    "Teste de entrega SMTP da Camisaria Mendes.",
    "",
    `Identificador: ${id}`,
    `Ambiente: ${config.environment}`,
    `Site: ${config.publicAppUrl}`,
    "",
    "Se esta mensagem chegou, autenticação, envio e recebimento SMTP funcionaram de ponta a ponta.",
  ].join("\n"),
});

console.log(`E-mail de teste aceito pelo SMTP para ${recipient}. Confirme também o recebimento na caixa de entrada e o SPF/DKIM nos cabeçalhos.`);
