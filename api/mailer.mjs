import net from "node:net";
import { randomUUID } from "node:crypto";
import tls from "node:tls";
import { config } from "./config.mjs";

/** Cliente SMTP mínimo para as mensagens transacionais de texto da aplicação. */

const socketTimeoutMs = 15000;

export function mailerConfigured() {
  const { host, user, password, from } = config.smtp;
  return Boolean(host && user && password && from);
}

function connect() {
  const { host, port } = config.smtp;
  // 465 é TLS desde o primeiro byte; 587 abre em texto claro e sobe com STARTTLS.
  const implicitTls = port === 465;
  const socket = implicitTls
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });
  socket.setTimeout(socketTimeoutMs);
  return { socket, implicitTls };
}

/** Junta os pedaços do socket e entrega uma resposta SMTP completa por vez. */
function createReader(socket) {
  const state = { buffer: "", error: null, closed: false, notify: null };
  const wake = () => {
    const notify = state.notify;
    state.notify = null;
    if (notify) notify();
  };
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => { state.buffer += chunk; wake(); });
  socket.on("error", (error) => { state.error = error; wake(); });
  socket.on("timeout", () => { state.error = new Error("Tempo esgotado ao falar com o servidor SMTP."); socket.destroy(); wake(); });
  socket.on("close", () => { state.closed = true; wake(); });

  return {
    attach(nextSocket) {
      nextSocket.setEncoding("utf8");
      nextSocket.on("data", (chunk) => { state.buffer += chunk; wake(); });
      nextSocket.on("error", (error) => { state.error = error; wake(); });
      nextSocket.on("close", () => { state.closed = true; wake(); });
    },
    async read() {
      for (;;) {
        if (state.error) throw state.error;
        // A última linha de uma resposta SMTP usa espaço após o código; as
        // intermediárias usam hífen. Só aí a resposta está completa.
        if (state.buffer.endsWith("\r\n")) {
          const lines = state.buffer.split("\r\n").filter((line) => line.length > 0);
          const last = lines[lines.length - 1];
          if (/^\d{3} /.test(last)) {
            const text = state.buffer;
            state.buffer = "";
            return { code: Number.parseInt(last.slice(0, 3), 10), text: text.trimEnd() };
          }
        }
        if (state.closed) throw new Error("O servidor SMTP encerrou a conexão.");
        await new Promise((resolve) => { state.notify = resolve; });
      }
    },
  };
}

async function expect(reader, accepted, step) {
  const response = await reader.read();
  if (!accepted.includes(response.code)) {
    throw new Error(`SMTP recusou ${step}: ${response.text}`);
  }
  return response;
}

function write(socket, line) {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (error) => (error ? reject(error) : resolve()));
  });
}

function encodeHeader(value) {
  // Assunto com acento precisa viajar codificado; ASCII puro segue como está.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function encodeBody(text) {
  // Base64 em linhas de 76 caracteres dispensa cuidar de linha longa e de ponto
  // isolado no início da linha, que o SMTP interpretaria como fim da mensagem.
  return (Buffer.from(text, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

export async function sendMail({ to, subject, text, messageId }) {
  if (!mailerConfigured()) throw new Error("SMTP não configurado.");
  if (!/^[^@\s]+@[^@\s]+$/.test(String(to)) || /[\r\n]/.test(String(to))) {
    throw new Error("Destinatário de e-mail inválido.");
  }
  if (/[\r\n]/.test(String(subject))) throw new Error("Assunto de e-mail inválido.");
  const { host, user, password, from, fromName } = config.smtp;
  const connection = connect();
  let socket = connection.socket;
  const reader = createReader(socket);

  try {
    await new Promise((resolve, reject) => {
      socket.once(connection.implicitTls ? "secureConnect" : "connect", resolve);
      socket.once("error", reject);
    });
    // O EHLO se identifica com o domínio público do site, que é o nome pelo qual
    // este servidor é conhecido — usar "localhost" costuma render recusa.
    const clientName = config.publicAppUrl.replace(/^https?:\/\//, "").split(/[:/]/)[0] || "localhost";
    await expect(reader, [220], "a conexão");
    await write(socket, `EHLO ${clientName}`);
    const greeting = await expect(reader, [250], "o EHLO");

    if (!connection.implicitTls) {
      if (!/STARTTLS/i.test(greeting.text)) throw new Error("O servidor SMTP não oferece STARTTLS; use a porta 465.");
      await write(socket, "STARTTLS");
      await expect(reader, [220], "o STARTTLS");
      socket = tls.connect({ socket, servername: host });
      socket.setTimeout(socketTimeoutMs);
      reader.attach(socket);
      await new Promise((resolve, reject) => {
        socket.once("secureConnect", resolve);
        socket.once("error", reject);
      });
      await write(socket, `EHLO ${clientName}`);
      await expect(reader, [250], "o EHLO seguro");
    }

    await write(socket, "AUTH LOGIN");
    await expect(reader, [334], "o início da autenticação");
    await write(socket, Buffer.from(user, "utf8").toString("base64"));
    await expect(reader, [334], "o usuário");
    await write(socket, Buffer.from(password, "utf8").toString("base64"));
    await expect(reader, [235], "a senha");

    await write(socket, `MAIL FROM:<${from}>`);
    await expect(reader, [250], "o remetente");
    await write(socket, `RCPT TO:<${to}>`);
    await expect(reader, [250, 251], "o destinatário");
    await write(socket, "DATA");
    await expect(reader, [354], "o início da mensagem");

    const messageDomain = from.split("@")[1] ?? "camisaria-mendes";
    const safeMessageId = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(String(messageId ?? ""))
      ? messageId
      : `${randomUUID()}@${messageDomain}`;
    const headers = [
      `From: ${encodeHeader(fromName)} <${from}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${safeMessageId}>`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
    ].join("\r\n");
    await write(socket, `${headers}\r\n\r\n${encodeBody(text)}\r\n.`);
    await expect(reader, [250], "o envio");
    await write(socket, "QUIT");
  } finally {
    socket.destroy();
  }
}
