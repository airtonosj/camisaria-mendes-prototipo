import { FormEvent, useEffect, useRef, useState } from "react";
import { createPaymentReceiver, fetchPaymentReceivers, updatePaymentReceiver } from "../../api";
import type { ApiPaymentReceiver } from "../../api";
import { normalizeInfinitePayHandle, validInfinitePayHandle } from "../../../shared/receiver.mjs";
import { errorMessage } from "../admin/model";
import { formattedWhatsapp, localWhatsapp } from "../../phone";

/* ------------------------------------------------------------------ */
/* Recebedores de pagamento                                            */
/* ------------------------------------------------------------------ */

type Draft = { id: number | null; name: string; email: string; phone: string; handle: string };

const emptyDraft: Draft = { id: null, name: "", email: "", phone: "", handle: "" };

/**
 * Contas InfinitePay que podem receber o dinheiro de uma campanha. O recebedor não
 * entra no painel: é só o destino do pagamento, escolhido na criação da campanha.
 * O `$` da InfiniteTag fica fixo no campo e o handle é salvo sem ele.
 */
export function PaymentReceivers() {
  const [receivers, setReceivers] = useState<ApiPaymentReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [removing, setRemoving] = useState<ApiPaymentReceiver | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modalOpen = draft !== null || removing !== null;
  const activeCount = receivers.filter((receiver) => receiver.active).length;

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    element?.querySelector<HTMLInputElement>("input")?.focus();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [modalOpen]);

  function closeDialog() {
    if (saving) return;
    setRemoving(null);
    edit(null);
  }

  useEffect(() => {
    let active = true;
    fetchPaymentReceivers()
      .then((list) => { if (active) setReceivers(list); })
      .catch((loadError) => { if (active) setError(errorMessage(loadError, "Não foi possível carregar os recebedores.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function edit(next: Draft | null) {
    setDraft(next);
    setConfirming(false);
    setError("");
    setFeedback("");
  }

  function change(field: keyof Omit<Draft, "id">, value: string) {
    if (!draft) return;
    setDraft({ ...draft, [field]: field === "handle" ? normalizeInfinitePayHandle(value) : value });
    setConfirming(false);
    setError("");
  }

  function replace(receiver: ApiPaymentReceiver) {
    setReceivers((current) => {
      const others = current.filter((item) => item.id !== receiver.id);
      return [...others, receiver].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (!validInfinitePayHandle(draft.handle)) {
      setError("Informe a InfiniteTag do recebedor, com ao menos 2 letras ou números.");
      return;
    }
    // Um erro de digitação manda o dinheiro para outra conta: a tag final é conferida antes.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = {
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        infinitepayHandle: draft.handle,
      };
      const saved = draft.id === null
        ? await createPaymentReceiver(input)
        : await updatePaymentReceiver(draft.id, input);
      replace(saved);
      setDraft(null);
      setConfirming(false);
      setFeedback(draft.id === null ? "Recebedor cadastrado." : "Recebedor atualizado.");
    } catch (saveError) {
      setConfirming(false);
      setError(errorMessage(saveError, "Não foi possível salvar o recebedor."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(receiver: ApiPaymentReceiver) {
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      replace(await updatePaymentReceiver(receiver.id, { active: !receiver.active }));
      setFeedback(receiver.active ? "Recebedor desativado. Campanhas já vinculadas continuam recebendo nesta conta." : "Recebedor reativado.");
      setRemoving(null);
    } catch (toggleError) {
      setError(errorMessage(toggleError, "Não foi possível alterar o recebedor."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-account-card payment-receivers" aria-labelledby="payment-receivers-title">
      <header>
        <div>
          <h3 id="payment-receivers-title">Recebedores de pagamento <span className="admin-account-role">{activeCount} {activeCount === 1 ? "ativo" : "ativos"}</span></h3>
          <p>Contas InfinitePay para os pagamentos das campanhas.</p>
        </div>
          <button className="primary-action" type="button" onClick={() => edit({ ...emptyDraft })}>
            <span className="material-symbols-rounded" aria-hidden="true">add</span>Novo recebedor
          </button>
      </header>

      {loading ? (
        <p className="payment-receivers-empty">Carregando recebedores...</p>
      ) : receivers.length === 0 ? (!draft && (
        <p className="payment-receivers-empty">Nenhum recebedor cadastrado. Todas as campanhas recebem na conta padrão.</p>
      )) : (
        <ul className="payment-receivers-list">
          {receivers.map((receiver) => (
            <li key={receiver.id} className={receiver.active ? "" : "is-inactive"}>
              <div>
                <strong>{receiver.name}</strong>
                <span className="payment-receivers-handle">${receiver.infinitepayHandle}</span>
                <small>
                  {[receiver.phone && formattedWhatsapp(receiver.phone), receiver.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                  {" · "}
                  {receiver.campaigns.length === 0 ? "nenhuma campanha" : receiver.campaigns.length === 1 ? "1 campanha" : `${receiver.campaigns.length} campanhas`}
                  {!receiver.active && " · desativado"}
                </small>
              </div>
              <div className="payment-receivers-actions">
                <button type="button" onClick={() => edit({
                  id: receiver.id,
                  name: receiver.name,
                  email: receiver.email ?? "",
                  phone: receiver.phone ? localWhatsapp(receiver.phone) : "",
                  handle: receiver.infinitepayHandle,
                })} aria-label={`Editar ${receiver.name}`} title="Editar" disabled={saving}>
                  <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                </button>
                <button type="button" className={receiver.active ? "receiver-remove" : ""} disabled={saving} onClick={() => { if (receiver.active) { setError(""); setFeedback(""); setRemoving(receiver); } else { void toggle(receiver); } }} aria-label={`${receiver.active ? "Remover" : "Reativar"} ${receiver.name}`} title={receiver.active ? "Remover" : "Reativar"}>
                  <span className="material-symbols-rounded" aria-hidden="true">{receiver.active ? "delete" : "restore"}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="payment-receivers-note">Sem recebedor selecionado, a campanha usa a conta padrão.</p>
      {modalOpen && <dialog ref={dialog} className="pickup-dialog receiver-dialog" aria-labelledby="receiver-dialog-title" onCancel={(event) => { event.preventDefault(); closeDialog(); }}>
        <header className="pickup-heading">
          <span className="pickup-heading-icon"><span className="material-symbols-rounded" aria-hidden="true">{removing ? "delete" : "wallet"}</span></span>
          <div><h2 id="receiver-dialog-title">{removing ? "Remover recebedor" : draft?.id === null ? "Novo recebedor" : "Editar recebedor"}</h2><p>{removing ? removing.name : "Cadastre a conta que receberá os pagamentos."}</p></div>
          <button className="pickup-close" type="button" aria-label="Fechar" disabled={saving} onClick={closeDialog}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
        </header>
      {draft && (
        <form onSubmit={save} aria-label={draft.id === null ? "Novo recebedor" : "Editar recebedor"}>
          <fieldset disabled={saving} className="receiver-dialog-fields">
          <label className="campaign-field campaign-field--wide"><span>Nome completo</span><input value={draft.name} onChange={(event) => change("name", event.target.value)} minLength={3} maxLength={160} required /></label>
          <label className="campaign-field"><span>Telefone</span><input type="tel" value={draft.phone} onChange={(event) => change("phone", event.target.value)} inputMode="tel" placeholder="(00) 00000-0000" /></label>
          <label className="campaign-field"><span>E-mail</span><input type="email" value={draft.email} onChange={(event) => change("email", event.target.value)} placeholder="Opcional" /></label>
          <label className="campaign-field campaign-field--wide">
            <span>InfiniteTag (handle InfinitePay)</span>
            <span className="payment-receivers-tag">
              <span aria-hidden="true">$</span>
              <input value={draft.handle} onChange={(event) => change("handle", event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={64} placeholder="nome-da-conta" required aria-describedby="payment-receivers-tag-help" />
            </span>
            <small id="payment-receivers-tag-help">Digite sem o $. Letras minúsculas, números, ponto, hífen e sublinhado.</small>
          </label>
          </fieldset>
          {confirming && (
            <p className="payment-receivers-confirm" role="alert">
              <span className="material-symbols-rounded" aria-hidden="true">wallet</span>
              <span>Confira: os pagamentos das campanhas deste recebedor irão para <strong>${draft.handle}</strong>. Clique em confirmar para salvar.</span>
            </p>
          )}
          {error && <p className="campaign-form-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{error}</p>}
          <div className="pickup-footer">
            <button className="pickup-secondary" type="button" onClick={closeDialog} disabled={saving}>Cancelar</button>
            <button className="pickup-primary" type="submit" disabled={saving}>
              {saving ? "Salvando..." : confirming ? "Confirmar e salvar" : "Salvar recebedor"}
              <span className="material-symbols-rounded" aria-hidden="true">check</span>
            </button>
          </div>
        </form>
      )}
      {removing && <div className="receiver-remove-confirm">
        <p>O recebedor ficará desativado para novas campanhas. As campanhas vinculadas e o histórico serão preservados.</p>
        {error && <p className="pickup-error" role="alert">{error}</p>}
        <div className="pickup-footer"><button className="pickup-secondary" type="button" onClick={closeDialog} disabled={saving}>Cancelar</button><button className="pickup-primary" type="button" disabled={saving} onClick={() => void toggle(removing)}>{saving ? "Desativando..." : "Desativar recebedor"}</button></div>
      </div>}
      </dialog>}

      {!modalOpen && error && <p className="campaign-form-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{error}</p>}
      {!modalOpen && feedback && <p className="admin-account-feedback" role="status" aria-live="polite">{feedback}</p>}
    </section>
  );
}
