import { FormEvent, useState } from "react";
import { buildRoute, STAFF_SESSION_KEY, TEST_STAFF_EMAIL, TEST_STAFF_PASSWORD } from "../App";
import { Brand } from "./Brand";

export function CamisariaAccessPage() {
  const [email, setEmail] = useState(TEST_STAFF_EMAIL);
  const [password, setPassword] = useState(TEST_STAFF_PASSWORD);
  const [error, setError] = useState("");

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim().toLowerCase() !== TEST_STAFF_EMAIL || password !== TEST_STAFF_PASSWORD) {
      setError("Dados de teste incorretos. Use as credenciais exibidas abaixo.");
      return;
    }
    sessionStorage.setItem(STAFF_SESSION_KEY, "authenticated");
    window.location.assign(buildRoute("admin"));
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-panel">
        <Brand />
        <div className="staff-login-heading"><span className="kicker">Área restrita</span><h1>Acesso da equipe</h1><p>Entre para gerenciar campanhas, pedidos e produção.</p></div>
        <form onSubmit={signIn}>
          <label htmlFor="staff-email">E-mail</label>
          <input id="staff-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="username" required />
          <label htmlFor="staff-password">Senha</label>
          <input id="staff-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="current-password" required />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" type="submit">Entrar no painel<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        </form>
        <div className="test-credentials"><span className="material-symbols-rounded" aria-hidden="true">info</span><div><strong>Acesso de demonstração</strong><code>{TEST_STAFF_EMAIL}</code><code>{TEST_STAFF_PASSWORD}</code></div></div>
        <a className="staff-back" href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar ao site público</a>
      </section>
      <aside className="staff-login-art"><img src={new URL("../../assets/shirt-oversized.png", import.meta.url).href} alt="Camisa oversized Camisaria Mendes" /><div><span>Área interna</span><strong>Campanhas.<br />Pedidos.<br />Produção.</strong></div></aside>
    </main>
  );
}
