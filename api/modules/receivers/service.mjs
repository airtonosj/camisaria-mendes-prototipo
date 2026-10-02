import * as queries from './repository.mjs';
import { pool, withTransaction } from "../../database.mjs";
import { config } from "../../config.mjs";
import { ApiError } from "../../http/response.mjs";
import { requireText, optionalText, normalizeWhatsapp } from "../../http/validation.mjs";
import { normalizeCustomerEmail } from "../../../shared/contact.mjs";
import { normalizeInfinitePayHandle, validInfinitePayHandle } from "../../../shared/receiver.mjs";

/**
 * Recebedores de pagamento. Cada um é só uma conta InfinitePay de destino, escolhida
 * por campanha; não tem login nem acesso ao painel. Campanha sem recebedor continua
 * recebendo na conta padrão do servidor (`INFINITEPAY_HANDLE`).
 */

export function receiverPayload(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    infinitepayHandle: row.infinitepay_handle,
    active: Boolean(row.active),
  };
}

export function defaultInfinitePayHandle() {
  return config.payments.infinitePay.handle;
}

export function parseInfinitePayHandle(value) {
  const handle = normalizeInfinitePayHandle(value);
  if (!validInfinitePayHandle(handle)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Informe a InfiniteTag do recebedor, com ao menos 2 letras ou números.");
  }
  return handle;
}

function parseReceiverBody(body) {
  const name = requireText(body.name, "name", 160);
  let email = null;
  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    email = normalizeCustomerEmail(body.email);
    if (!email) throw new ApiError(422, "VALIDATION_ERROR", "Informe um e-mail válido para o recebedor.");
  }
  const phone = optionalText(body.phone, 30) ? normalizeWhatsapp(body.phone, "phone") : null;
  const infinitepayHandle = parseInfinitePayHandle(body.infinitepayHandle);
  return { name, email, phone, infinitepayHandle };
}

async function assertHandleAvailable(connection, handle, receiverId = 0) {
  const [rows] = await queries.findReceiverByHandleQuery(connection, [handle, receiverId]);
  if (rows.length > 0) {
    throw new ApiError(409, "HANDLE_IN_USE", "Já existe um recebedor com esta InfiniteTag.");
  }
}

function pendingCheckoutError(total) {
  const pedidos = total === 1 ? "1 pedido" : `${total} pedidos`;
  return new ApiError(
    409,
    "RECEIVER_IN_USE",
    `Há ${pedidos} com pagamento em preparação ou link emitido para a conta atual e ainda não pago. Aguarde o pagamento ou cancele esses pedidos antes de trocar a conta de recebimento.`,
    { pendingCheckouts: total },
  );
}

export async function listReceivers() {
  const [rows] = await queries.listReceiversQuery(pool);
  const [campaignRows] = await queries.receiverCampaignsQuery(pool);
  const campaignsByReceiver = new Map();
  for (const row of campaignRows) {
    const list = campaignsByReceiver.get(Number(row.receiver_id)) ?? [];
    list.push({ code: row.code, title: row.title });
    campaignsByReceiver.set(Number(row.receiver_id), list);
  }
  return rows.map((row) => ({
    ...receiverPayload(row),
    campaigns: campaignsByReceiver.get(Number(row.id)) ?? [],
  }));
}

/** @param {{staff:{id:number}, body:import("../../../shared/contracts").CreateReceiverPayload}} input */
export async function createReceiver({ staff, body }) {
  const receiver = parseReceiverBody(body ?? {});
  const id = await withTransaction(async (connection) => {
    await assertHandleAvailable(connection, receiver.infinitepayHandle);
    const [result] = await queries.createReceiverQuery(connection, [
      receiver.name, receiver.email, receiver.phone, receiver.infinitepayHandle, staff.id,
    ]);
    return result.insertId;
  });
  const [rows] = await queries.findReceiverQuery(pool, [id]);
  return { ...receiverPayload(rows[0]), campaigns: [] };
}

/** @param {{body:import("../../../shared/contracts").UpdateReceiverPayload}} input */
export async function updateReceiver({ body }, receiverId) {
  const id = Number(receiverId);
  await withTransaction(async (connection) => {
    const [rows] = await queries.findReceiverQuery(connection, [id], { lock: true });
    if (rows.length === 0) throw new ApiError(404, "RECEIVER_NOT_FOUND", "Recebedor não encontrado.");
    const current = rows[0];
    const next = parseReceiverBody({
      name: body.name ?? current.name,
      email: body.email === undefined ? current.email : body.email,
      phone: body.phone === undefined ? current.phone : body.phone,
      infinitepayHandle: body.infinitepayHandle ?? current.infinitepay_handle,
    });
    const active = body.active === undefined ? Boolean(current.active) : body.active === true;
    if (next.infinitepayHandle !== current.infinitepay_handle) {
      await assertHandleAvailable(connection, next.infinitepayHandle, id);
      const [pending] = await queries.pendingCheckoutsQuery(
        connection,
        [id, current.infinitepay_handle],
        "c.receiver_id = ? AND pc.handle = ?",
      );
      if (Number(pending[0].total) > 0) throw pendingCheckoutError(Number(pending[0].total));
    }
    await queries.updateReceiverQuery(connection, [
      next.name, next.email, next.phone, next.infinitepayHandle, active, id,
    ]);
  });
  const list = await listReceivers();
  return list.find((receiver) => receiver.id === id);
}

/**
 * Valida o recebedor escolhido na campanha. `null` volta para a conta padrão.
 * Um recebedor inativo não pode ser escolhido de novo, mas a campanha que já o usa
 * continua com ele: desativar não muda para onde vai o dinheiro já combinado.
 */
export async function resolveCampaignReceiver(connection, value, currentReceiverId = null) {
  if (value === null || value === "" || value === 0) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(422, "RECEIVER_INVALID", "Escolha um recebedor válido para a campanha.");
  }
  const [rows] = await queries.findReceiverQuery(connection, [id]);
  const receiver = rows[0];
  if (!receiver || (!receiver.active && Number(currentReceiverId) !== id)) {
    throw new ApiError(422, "RECEIVER_INVALID", "O recebedor escolhido não existe ou está desativado.");
  }
  return receiver;
}

/** Recusa trocar a conta de uma campanha com links pendentes emitidos para outra conta. */
export async function assertCampaignReceiverChangeAllowed(connection, campaignId, nextHandle) {
  const [pending] = await queries.pendingCheckoutsQuery(
    connection,
    [campaignId, defaultInfinitePayHandle() ?? "", nextHandle ?? ""],
    "c.id = ? AND COALESCE(pc.handle, ?) <> ?",
  );
  if (Number(pending[0].total) > 0) throw pendingCheckoutError(Number(pending[0].total));
}
