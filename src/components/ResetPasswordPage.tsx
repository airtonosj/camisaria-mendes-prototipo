import { FormEvent, useEffect, useState } from "react";
import { checkPasswordResetToken, confirmPasswordReset } from "../api";
import { buildRoute } from "../App";
import { Brand } from "./Brand";

const minimumPasswordLength = 8;

/**
 * Redefinição por link. O token é conferido antes de mostrar o formulário para o
 * usuário não digitar uma senha nova e só então descobrir que o link venceu.
 */
export function ResetPasswordPage({ token }: { token: string }) {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">(token ? "checking" : "invalid");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    checkPasswordResetToken(token)
      .then((payload) => {
        if (!active) return;
        setAccount(payload.email);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("invalid");
      });
    return () => { active = false; };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < minimumPasswordLength) {
      setError(`A senha precisa ter ao menos ${minimumPasswordLength} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, password);
      setState("done");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Não foi possível redefinir a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-panel">
        <Brand />
        {state === "checking" && (
          <div className="staff-login-heading"><span className="kicker">Recuperar acesso</span><h1>Conferindo o link...</h1><p>Um instante.</p></div>
        )}

        {state === "invalid" && (
          <>
            <div className="staff-login-heading"><span className="kicker">Recuperar acesso</span><h1>Link inválido</h1><p>Este link de redefinição expirou ou já foi usado. Peça um novo na tela de acesso.</p></div>
            <a className="primary-action" href={buildRoute("acesso-camisaria")}>Ir para o acesso da equipe<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a>
          </>
        )}

        {state === "ready" && (
          <>
            <div className="staff-login-heading"><span className="kicker">Recuperar acesso</span><h1>Escolha a nova senha</h1><p>Redefinindo a senha de <strong>{account}</strong>. As sessões abertas serão encerradas.</p></div>
            <form onSubmit={submit}>
              <label htmlFor="reset-password">Nova senha</label>
              <input id="reset-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={minimumPasswordLength} required />
              <label htmlFor="reset-confirmation">Repita a nova senha</label>
              <input id="reset-confirmation" type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" minLength={minimumPasswordLength} required />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar nova senha"}<span className="material-symbols-rounded" aria-hidden="true">check</span></button>
            </form>
          </>
        )}

        {state === "done" && (
          <>
            <div className="staff-login-heading"><span className="kicker">Tudo certo</span><h1>Senha redefinida</h1><p>Entre no painel com a nova senha.</p></div>
            <a className="primary-action" href={buildRoute("acesso-camisaria")}>Entrar no painel<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></a>
          </>
        )}

        <a className="staff-back" href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar ao site público</a>
      </section>
      <aside className="staff-login-art"><img src={new URL("../../assets/shirt-oversized.png", import.meta.url).href} alt="Camisa oversized Camisaria Mendes" /><div><span>Área interna</span><strong>Campanhas.<br />Pedidos.<br />Produção.</strong></div></aside>
    </main>
  );
}
