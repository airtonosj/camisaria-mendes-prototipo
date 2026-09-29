import http from "node:http";
import { config } from "./config.mjs";
import { pool } from "./database.mjs";
import { startOrderEmailNotificationWorker } from "./order-email-notifications.mjs";
import { PaymentIntegrationError, startInfinitePayReconciliationWorker } from "./infinitepay-payments.mjs";
import { LicenseControlError, LicenseTokenError } from "./license-control.mjs";
import { ApiError, sendJson } from "./http/response.mjs";
import { reportStartupChecks, productionStartupErrors } from "./runtime/startup.mjs";
import { cleanupStaleVideoParts } from "./modules/media/service.mjs";
import { route } from "./http/router.mjs";
import { observeRequest } from './http/telemetry.mjs';

export const server = http.createServer((request, response) => {
  const requestId=observeRequest(request,response);
  route(request, response).catch((error) => {
    const knownError = error instanceof ApiError
      || error instanceof PaymentIntegrationError
      || error instanceof LicenseControlError
      || error instanceof LicenseTokenError;
    const status = knownError ? error.status : 500;
    const code = knownError ? error.code : "INTERNAL_ERROR";
    response.errorCode=code;
    if (!knownError) console.error(JSON.stringify({event:'request_error',requestId,code}));
    if (response.headersSent) { response.destroy(); return; }
    sendJson(response, status, {
      error: { code, message: knownError ? error.message : "Erro interno do servidor.", details: error.details },
    });
  });
});

export let stopOrderEmailWorker = () => {};

export let stopInfinitePayWorker = () => {};

export const startupErrors = await productionStartupErrors();

if (startupErrors.length > 0) {
  for (const error of startupErrors) console.error(`Configuração de produção recusada: ${error}`);
  await pool.end();
  process.exitCode = 1;
} else {
  server.listen(config.port, config.host, async () => {
    console.log(`API da Camisaria Mendes em http://${config.host}:${config.port} (${config.environment})`);
    await cleanupStaleVideoParts();
    await reportStartupChecks();
    stopOrderEmailWorker = startOrderEmailNotificationWorker();
    stopInfinitePayWorker = startInfinitePayReconciliationWorker();
  });
}

export async function shutdown(signal) {
  console.log(`${signal}: encerrando API...`);
  const timeout=setTimeout(()=>process.exit(1),20000); timeout.unref();
  await Promise.all([stopOrderEmailWorker(),stopInfinitePayWorker(),new Promise(resolve=>server.close(resolve))]);
  await pool.end(); clearTimeout(timeout); process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("SIGTERM", () => shutdown("SIGTERM"));
