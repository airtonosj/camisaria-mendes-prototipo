import { config } from "../config.mjs";
import { getLicenseState } from "../license-control.mjs";
import { serveLicenseSuspendedPage } from "../license-control-page.mjs";
import { ApiError } from "./response.mjs";

export function assertLicenseControlEnabled() {
  if (!config.license.controlEnabled) {
    throw new ApiError(404, "ROUTE_NOT_FOUND", "Rota não encontrada.");
  }
}

export function administrativeFrontendAllowedDuringSuspension(requestUrl, path) {
  const routeName = requestUrl.searchParams.get("rota");
  return path.endsWith("/acesso-camisaria")
    || path.endsWith("/acompanhar-pedido")
    || new Set(["admin", "acesso-camisaria", "redefinir-senha", "acompanhar-pedido"]).has(routeName);
}

export function mutationAllowedDuringSuspension(method, path) {
  if (path.startsWith("/api/auth/")) return true;
  if (method === "PATCH" && path === "/api/admin/account") return true;
  if (method === "POST" && new Set([
    "/api/payments/infinitepay/webhook",
    "/api/payments/infinitepay/reconcile",
  ]).has(path)) return true;
  if (method === "PATCH" && /^\/api\/admin\/orders\/[^/]+\/(cancel|delivery)$/.test(path)) return true;
  if (method === "POST" && /^\/api\/admin\/orders\/[^/]+\/refund$/.test(path)) return true;
  return false;
}

export async function enforceLicenseState(request, response, requestUrl, path) {
  const state = await getLicenseState();
  if (!state.enabled || state.status !== "suspended") return false;
  if ((request.method === "GET" || request.method === "HEAD") && !path.startsWith("/api/")) {
    if (administrativeFrontendAllowedDuringSuspension(requestUrl, path)) return false;
    serveLicenseSuspendedPage(request, response);
    return true;
  }
  if (request.method === "GET" || request.method === "HEAD" || mutationAllowedDuringSuspension(request.method, path)) {
    return false;
  }
  throw new ApiError(
    423,
    "LICENSE_SUSPENDED",
    "A licença desta instalação está suspensa. Operações novas permanecem bloqueadas até a reativação.",
  );
}
