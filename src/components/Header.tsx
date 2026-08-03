import { useState } from "react";
import { buildRoute } from "../App";
import { Brand } from "./Brand";

const links = [
  ["#inicio", "Início"],
  ["#mostruario", "Mostruário"],
  ["#como-funciona", "Como funciona"],
  ["#sobre", "Sobre nós"],
  ["#faca-sua-campanha", "Faça sua campanha"],
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand compact />
        <nav className="desktop-nav" aria-label="Navegação principal">
          {links.map(([href, label], index) => <a className={index === 0 ? "is-current" : ""} href={href} key={href}>{label}</a>)}
        </nav>
        <a className="header-code-link" href={buildRoute("acesso-campanha")}>
          Tenho um código
          <span className="material-symbols-rounded" aria-hidden="true">radio_button_checked</span>
        </a>
        <button
          className="menu-button"
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">{open ? "close" : "menu"}</span>
        </button>
      </div>
      <nav className={`mobile-nav ${open ? "is-open" : ""}`} aria-label="Navegação mobile">
        {links.map(([href, label]) => <a href={href} key={href} onClick={() => setOpen(false)}>{label}</a>)}
        <a href={buildRoute("acesso-campanha")} onClick={() => setOpen(false)}>Tenho um código</a>
      </nav>
    </header>
  );
}
