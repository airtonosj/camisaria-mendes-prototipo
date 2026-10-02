import { FormEvent, useEffect, useState } from "react";
import { updateStaffAccount } from "../../api";
import type { StaffUser } from "../../api";
import { errorMessage } from "../admin/model";
import { PaymentReceivers } from "./PaymentReceivers";

/* ------------------------------------------------------------------ */
/* Conta da equipe                                                     */
/* ------------------------------------------------------------------ */

/**
 * Troca de e-mail e senha do próprio acesso. É o caminho previsto para tirar do ar o
 * cadastro inicial (`gustavo@mendes` com senha provisória) sem passar por linha de
 * comando. A senha atual é sempre exigida, mesmo já havendo sessão aberta.
 */
export function Account({ user, onSaved }: { user: StaffUser | null; onSaved: (user: StaffUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  if (!user) {
    return (
      <div className="admin-content">
        <section className="simple-state">
          <span className="material-symbols-rounded" aria-hidden="true">manage_accounts</span>
          <h3>Conta indisponível</h3>
          <p>Entre no painel com uma sessão do servidor para alterar e-mail e senha.</p>
        </section>
      </div>
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    if (newPassword && newPassword.length < 8) {
      setError("A nova senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (newPassword && newPassword !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateStaffAccount({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        currentPassword,
        newPassword: newPassword || undefined,
      });
      onSaved(result.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setFeedback(result.passwordChanged
        ? "Dados salvos e senha trocada. As outras sessões abertas foram encerradas."
        : "Dados da conta salvos.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Não foi possível salvar a conta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-content admin-account-page">
      <div className="section-actions">
        <div><span className="kicker">Acesso</span><h2>Conta da camisaria</h2><p>Troque o e-mail e a senha usados para entrar no painel e cadastre quem recebe o pagamento das campanhas.</p></div>
      </div>

      <section className="admin-account-card" aria-labelledby="account-form-title">
        <header>
          <div><h3 id="account-form-title">Dados de acesso</h3><p>A senha atual confirma que é você quem está alterando.</p></div>
          <span className={`admin-account-role admin-account-role--${user.role}`}>{user.role === "camisaria" ? "Camisaria" : "Representante"}</span>
        </header>
        <form onSubmit={save}>
          <label className="campaign-field"><span>Nome</span><input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} minLength={3} maxLength={160} required /></label>
          <label className="campaign-field"><span>E-mail de acesso</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="username" required /></label>
          <label className="campaign-field campaign-field--wide"><span>Senha atual</span><input type="password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); }} autoComplete="current-password" required /></label>
          <label className="campaign-field"><span>Nova senha</span><input type="password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} placeholder="Deixe vazio para manter a atual" /></label>
          <label className="campaign-field"><span>Repita a nova senha</span><input type="password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} autoComplete="new-password" minLength={8} /></label>
          {error && <p className="campaign-form-error" role="alert"><span className="material-symbols-rounded" aria-hidden="true">error</span>{error}</p>}
          <div className="campaign-create-actions">
            <p className="admin-account-feedback" role="status" aria-live="polite">{feedback}</p>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}<span className="material-symbols-rounded" aria-hidden="true">check</span></button>
          </div>
        </form>
      </section>

      {user.role === "camisaria" && !user.mustChangePassword && <PaymentReceivers />}
    </div>
  );
}
