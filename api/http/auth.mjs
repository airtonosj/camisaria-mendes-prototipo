import { resolveSession } from "../auth.mjs";
import { ApiError } from "./response.mjs";

export function bearerToken(request) {
  const header = String(request.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

/** Toda ação administrativa exige uma sessão válida, temporária e atribuída a uma conta. */
export async function requireStaff(request) {
  const session = await resolveSession(bearerToken(request));
  if (session) {
    if (session.user.role !== "camisaria") {
      throw new ApiError(403, "STAFF_ROLE_NOT_ALLOWED", "Esta conta não possui acesso ao painel da camisaria.");
    }
    // A senha provisória do cadastro inicial não abre o painel: enquanto ela valer, a
    // única rota liberada é a da própria conta. A trava é aqui, e não só na tela, para
    // não depender do navegador ter carregado a sessão.
    if (session.user.mustChangePassword) {
      throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Troque a senha provisória para liberar o painel.");
    }
    return session.user;
  }
  throw new ApiError(401, "UNAUTHORIZED", "Faça login para acessar o painel.");
}

/** Mexer na própria conta exige uma sessão de login válida. */
export async function requireSessionUser(request) {
  const session = await resolveSession(bearerToken(request));
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "Entre novamente para alterar a conta.");
  return session.user;
}
