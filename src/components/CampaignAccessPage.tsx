import { FormEvent, useState } from "react";
import { buildRoute } from "../App";
import { Brand } from "./Brand";

export function CampaignAccessPage({ invalidCampaignCode }: { invalidCampaignCode?: string }) {
  const [code, setCode] = useState(invalidCampaignCode ?? "");
  const [error, setError] = useState(invalidCampaignCode ? "Este código não foi encontrado." : "");

  /**
   * Quem decide se o código existe é o servidor, não uma lista no navegador: as
   * campanhas nascem no painel e o site publicado não conhece nenhuma delas de véspera.
   */
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!normalized) {
      setError("Digite o código enviado pelo representante da turma.");
      return;
    }
    window.location.assign(buildRoute(undefined, normalized));
  }

  return (
    <div className="access-page">
      <main className="access-page-main">
        <div className="access-page-logo"><Brand compact /></div>
        <div className="access-page-copy">
          <span className="access-private-label"><span className="material-symbols-rounded" aria-hidden="true">lock</span>Campanha privada</span>
          <h1>Acesse a campanha<br />da sua turma</h1>
          <p>Digite o código fornecido pelo representante para acessar os modelos e fazer seu pedido.</p>
        </div>
        <form className="access-form" onSubmit={submit}>
          <label htmlFor="access-code">Código da campanha</label>
          <input id="access-code" value={code} onChange={(event) => { setCode(event.target.value); setError(""); }} placeholder="Ex.: MENDES-ENG-26" autoComplete="off" autoCapitalize="characters" spellCheck="false" autoFocus />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" type="submit">Acessar campanha<span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
          <div className="access-divider"><span />ou<span /></div>
          <p className="access-hint"><span className="material-symbols-rounded" aria-hidden="true">link</span>Também funciona por link ou QR Code enviado pelo representante.</p>
        </form>
        <a className="access-back-link" href="./"><span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>Voltar ao site</a>
      </main>
    </div>
  );
}
