import http from 'node:http';
import { once } from 'node:events';
export const fakeInfinitePay = { links: [], checks: new Map(), checkRequests: [] };

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export async function startFakeInfinitePay(environment) {
  const server = http.createServer(async (request, response) => {
    const body = await readRequestJson(request);
    response.setHeader("Content-Type", "application/json");
    if (request.method === "POST" && request.url === "/links") {
      // O provedor real recusa telefone fora do formato internacional com
      // 422 "not a valid phone number". O fake precisa recusar igual: foi a ausencia
      // desta validacao que deixou passar um checkout enviando +DDD sem o codigo do pais.
      if (!/^[+]55[0-9]{10,11}$/.test(String(body.customer?.phone_number ?? ""))) {
        response.statusCode = 422;
        response.end(JSON.stringify({
          success: false,
          message: "Invalid checkout link params",
          errors: { customer: { phone_number: ["not a valid phone number"] } },
        }));
        return;
      }
      fakeInfinitePay.links.push(body);
      response.end(JSON.stringify({
        url: `https://checkout.infinitepay.io/smoke-infinitepay?lenc=${encodeURIComponent(body.order_nsu)}`,
      }));
      return;
    }
    if (request.method === "POST" && request.url === "/payment_check") {
      fakeInfinitePay.checkRequests.push(body);
      response.end(JSON.stringify(fakeInfinitePay.checks.get(body.transaction_nsu) ?? {
        success: true,
        paid: false,
        amount: 0,
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });
  const port = Number.parseInt(new URL(environment.INFINITEPAY_API_BASE_URL).port, 10);
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return server;
}
