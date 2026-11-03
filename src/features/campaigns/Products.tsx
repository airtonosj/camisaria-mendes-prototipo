import { campaignSizesInGroup } from "../../data";

export function Products() {
  return (
    <div className="admin-content">
      <div className="section-actions">
        <div><span className="kicker">Catálogo</span><h2>Cortes e tamanhos</h2><p>Peças e medidas disponíveis para compor novas campanhas.</p></div>
      </div>
      <section className="simple-state">
        <span className="material-symbols-rounded" aria-hidden="true">checkroom</span>
        <h3>2 cortes e 10 tamanhos comerciais</h3>
        <p>Tradicional: {campaignSizesInGroup("Comum", "standard").join(", ")}. Baby look: {campaignSizesInGroup("Comum", "baby_look").join(", ")}. Oversized: {campaignSizesInGroup("Oversized", "standard").join(", ")}.</p>
      </section>
    </div>
  );
}
