import { FormEvent, useState } from "react";
import { Brand } from "./Brand";

export function CamisariaAccessPage() {
  const [notice, setNotice] = useState(false);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(true);
  }

  return (
    <main className="staff-page">
      <section className="staff-panel">
        <Brand />
        <div className="staff-heading">
          <span className="material-symbols-rounded" aria-hidden="true">shield_lock</span>
          <div><span>Acesso reservado</span><h1>Painel da Camisaria</h1><p>Entre para gerenciar campanhas, pedidos e representantes.</p></div>
        </div>
        <form className="staff-form" onSubmit={signIn}>
          <label htmlFor="staff-email">E-mail</label>
          <input id="staff-email" type="email" placeholder="seuemail@camisariamendes.com" required />
          <label htmlFor="staff-password">Senha</label>
          <input id="staff-password" type="password" placeholder="Digite sua senha" required />
          <button className="button button--primary" type="submit">Entrar no painel<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        </form>
        {notice && <p className="staff-notice" role="status">A autenticação real será conectada ao backend na próxima etapa.</p>}
        <a className="back-link" href="./">Voltar ao site público</a>
      </section>
      <aside className="staff-art" aria-hidden="true"><span>M</span><span>DS</span><small>Área interna</small></aside>
    </main>
  );
}
