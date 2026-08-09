import { FormEvent, useState } from "react";
import { ApiRequestError, loginStaff, requestPasswordReset, setStaffToken } from "../api";
import { buildRoute, DEMO_STAFF_EMAIL, DEMO_STAFF_PASSWORD, STAFF_SESSION_KEY } from "../App";
import { Brand } from "./Brand";

export function CamisariaAccessPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await loginStaff(normalizedEmail, password);
      sessionStorage.setItem(STAFF_SESSION_KEY, "authenticated");
      window.location.assign(buildRoute("admin"));
    } catch (loginError) {
      const unavailable = loginError instanceof ApiRequestError && loginError.code === "API_UNAVAILABLE";
      // Só em desenvolvimento: no site publicado, servidor fora significa erro na tela,
      // nunca um painel com dados inventados.
      if (import.meta.env.DEV && unavailable && normalizedEmail === DEMO_STAFF_EMAIL && password === DEMO_STAFF_PASSWORD) {
        setStaffToken(null);
        sessionStorage.setItem(STAFF_SESSION_KEY, "demonstration");
        window.location.assign(buildRoute("admin"));
        return;
      }
      setError(
        unavailable
          ? "Não foi possível falar com o servidor. Tente novamente em alguns instantes."
          : loginError instanceof Error
            ? loginError.message
            : "Não foi possível entrar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function askForRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setRecoveryNotice("");
    setSubmitting(true);
    try {
      const delivery = await requestPasswordReset(recoveryEmail.trim().toLowerCase());
      setRecoveryNotice(
        delivery === "email"
          ? "Se houver uma conta com esse e-mail, o link de redefinição acabou de ser enviado. Ele vale por 1 hora e só pode ser usado uma vez."
          : "Este servidor ainda não tem envio de e-mail configurado. Peça a quem administra o servidor para gerar o link com o comando user:reset.",
      );
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : "Não foi possível pedir a redefinição.");
    } finally {
      setSubmitting(false);
    }
  }

  function openRecovery() {
    setMode("forgot");
    setRecoveryEmail(email.trim().toLowerCase());
    setRecoveryNotice("");
    setError("");
  }

  function backToLogin() {
    setMode("login");
    setRecoveryNotice("");
    setError("");
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-panel">
        <Brand />
        {mode === "login" ? (
          <>
            <div className="staff-login-heading"><span className="kicker">Área restrita</span><h1>Acesso da equipe</h1><p>Entre para gerenciar campanhas, pedidos e produção.</p></div>
            <form onSubmit={signIn}>
              <label htmlFor="staff-email">E-mail</label>
              <input id="staff-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="username" required />
              <label htmlFor="staff-password">Senha</label>
              <input id="staff-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "Entrando..." : "Entrar no painel"}<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
            </form>
            <button className="staff-forgot" type="button" onClick={openRecovery}>Esqueci minha senha</button>
          </>
        ) : (
          <>
            <div className="staff-login-heading"><span className="kicker">Recuperar acesso</span><h1>Redefinir senha</h1><p>Informe o e-mail da conta. Enviamos um link para você escolher uma nova senha.</p></div>
            <form onSubmit={askForRecovery}>
              <label htmlFor="recovery-email">E-mail da conta</label>
              <input id="recovery-email" type="email" value={recoveryEmail} onChange={(event) => { setRecoveryEmail(event.target.value); setRecoveryNotice(""); setError(""); }} autoComplete="username" required />
              {error && <p className="form-error" role="alert">{error}</p>}
              {recoveryNotice && <p className="staff-recovery-notice" role="status">{recoveryNotice}</p>}
              <button className="primary-action" type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar link de redefinição"}<span className="material-symbols-rounded" aria-hidden="true">mail</span></button>
            </form>
            <button className="staff-forgot" type="button" onClick={backToLogin}>Voltar para o login</button>
          </>
        )}
        {import.meta.env.DEV && (
          <div className="test-credentials"><span className="material-symbols-rounded" aria-hidden="true">info</span><div><strong>Acesso de demonstração (só em desenvolvimento)</strong><code>{DEMO_STAFF_EMAIL}</code><code>{DEMO_STAFF_PASSWORD}</code></div></div>
        )}
        <a className="staff-back" href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar ao site público</a>
      </section>
      <aside className="staff-login-art"><img src={new URL("../../assets/shirt-oversized.png", import.meta.url).href} alt="Camisa oversized Camisaria Mendes" /><div><span>Área interna</span><strong>Campanhas.<br />Pedidos.<br />Produção.</strong></div></aside>
    </main>
  );
}
