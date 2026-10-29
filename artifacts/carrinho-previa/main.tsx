import {createRoot} from "react-dom/client";
import {CartPreview} from "./CartPreview";
import {PrivateCampaignPage} from "../../src/features/checkout/PrivateCampaignPage";
import {privateCampaigns} from "../../src/data";
import "../../src/styles/icons.css";
import "../../src/styles.css";
import "./preview.css";
const original = new URLSearchParams(location.search).has("atual");
document.body.classList.toggle("proposed",!original);
const campaign = {...privateCampaigns["MENDES-ENG-26"], code:"PREVIA-CARRINHO", deadline:"Prévia demonstrativa", representative:"Representante da turma",variantIds:{Comum:{Preto:1,Branco:2,Azul:3},Oversized:{Branco:4,Preto:5,Azul:6}}};
// Ambiente independente: nenhuma operação de rede ou compra.
window.fetch=async()=>{throw new Error("Esta prévia demonstra somente a organização do carrinho.");};
createRoot(document.getElementById("root")!).render(<><nav className="preview-toolbar" aria-label="Comparar versões"><span>PRÉVIA · SEM COMPRA REAL</span><a href="?atual">Layout atual</a><a href="./index.html">Proposta Kith</a></nav>{original?<PrivateCampaignPage campaign={campaign}/>:<CartPreview campaign={campaign}/>}</>);
