import { useEffect, useRef, useState } from 'react';
import { confirmPickupEmail, fetchPickupInfo, previewPickupEmail } from '../api';
import type { PickupInfo, PickupPreview, PickupSettings } from '../api';
import { ContactInput } from './ContactInput';
import { formattedWhatsapp } from '../phone';

const labels: Record<string, string> = { pending: 'Na fila', sending: 'Enviando', sent: 'Aceitos pelo servidor', failed: 'Falhas', cancelled: 'Cancelados', uncertain: 'Precisam de conferência' };
const Icon = ({ name }: { name: string }) => <span className="material-symbols-rounded" aria-hidden="true">{name}</span>;
export function PickupEmailDialog({ code, title, onClose, onSent }: { code: string; title: string; onClose: () => void; onSent: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<PickupInfo | null>(null);
  const [settings, setSettings] = useState<PickupSettings>({ instructions: '', representative: '', phone: '', groupUrl: '' });
  const [preview, setPreview] = useState<PickupPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    setError('');
    fetchPickupInfo(code).then(data => {
      if (!active) return;
      setInfo(data); setSettings({ ...data.settings, phone: formattedWhatsapp(data.settings.phone) });
    }).catch(e => { if (active) setError(e.message || 'Não foi possível carregar as informações.'); });
    return () => { active = false; };
  }, [code, loadVersion]);
  async function confirm() {
    setBusy(true); setError('');
    try { setPreview(await previewPickupEmail(code, settings)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível gerar a prévia.'); }
    finally { setBusy(false); }
  }
  async function send() {
    if (!preview) return;
    setBusy(true); setError('');
    try {
      const result = await confirmPickupEmail(code, preview.batchId);
      onSent(result.alreadyConfirmed ? 'Este lote já foi confirmado. Nenhum aviso duplicado foi criado.' : `${result.queued} aviso(s) na fila de envio.${result.skipped ? ` ${result.skipped} pedido(s) deixaram de estar aptos e foram ignorados.` : ''}`);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível confirmar o envio. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const field = (key: keyof PickupSettings, value: string) => setSettings(old => ({ ...old, [key]: value }));
  return <dialog ref={dialog} className="pickup-dialog" aria-labelledby="pickup-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={e => { e.preventDefault(); void (preview ? send() : confirm()); }}>
      <header className="pickup-heading">
        <span className="pickup-heading-icon"><Icon name={preview ? 'preview' : 'mail'} /></span>
        <div><h2 id="pickup-title">{preview ? 'Prévia do e-mail' : 'Avisar compradores'}</h2><p>{preview ? 'Confira a mensagem antes de enviar.' : title}</p>{!preview && <span className="pickup-ready"><i />Pronta para entrega</span>}</div>
        <button type="button" className="pickup-close" aria-label="Fechar" disabled={busy} onClick={onClose}><Icon name="close" /></button>
      </header>
      {!info && !error && <p role="status">Carregando informações…</p>}
      {!info && error && <button type="button" className="pickup-secondary" onClick={() => setLoadVersion(v => v + 1)}>Tentar novamente</button>}
      {info && !preview && <>
        <section className="pickup-section"><h3><Icon name="inventory_2" />Retirada</h3>
          <label htmlFor="pickup-instructions">Orientações de retirada</label>
          <textarea id="pickup-instructions" required maxLength={255} rows={3} value={settings.instructions} onChange={e => field('instructions', e.target.value)} disabled={busy} />
        </section>
        <section className="pickup-section"><h3><Icon name="group" />Contato da turma</h3>
          <label htmlFor="pickup-representative">Representante</label>
          <div className="pickup-input"><Icon name="person" /><input id="pickup-representative" required maxLength={160} value={settings.representative} onChange={e => field('representative', e.target.value)} disabled={busy} /></div>
          <label htmlFor="pickup-phone">WhatsApp do representante</label>
          <div className="pickup-input"><Icon name="call" /><ContactInput id="pickup-phone" kind="phone" value={settings.phone} onChange={value => field('phone', value)} disabled={busy} /></div>
          <label htmlFor="pickup-group">Grupo no WhatsApp</label>
          <div className="pickup-input"><Icon name="link" /><input id="pickup-group" type="url" required maxLength={512} placeholder="https://chat.whatsapp.com/…" value={settings.groupUrl} onChange={e => field('groupUrl', e.target.value)} disabled={busy} /></div>
        </section>
        <p className="pickup-hint"><Icon name="info" /><span>Você poderá revisar o e-mail na próxima etapa.<br /><strong>{info.eligible} pedido(s) apto(s) ainda não avisado(s).</strong></span></p>
        {info.history.length > 0 && <details className="pickup-history"><summary>Histórico dos avisos</summary><dl>{info.history.map(item => <div key={item.status}><dt>{labels[item.status] || item.status}</dt><dd>{item.count}</dd></div>)}</dl><small>Aceitação pelo servidor não confirma recebimento ou leitura. Falhas têm até 3 tentativas; resultados incertos exigem conferência.</small></details>}
        {!info.configured && <p role="alert" className="pickup-error">O envio de e-mails não está configurado no servidor.</p>}
      </>}
      {preview && <>
        <section className="pickup-message"><small>ASSUNTO</small><h3>{preview.subject}</h3><div>{preview.text.split('\n').map((line, index) => <p className={!line ? 'pickup-message-gap' : undefined} key={index}>{/^https?:\/\//.test(line) ? <a href={line} target="_blank" rel="noreferrer"><Icon name={line.includes('wa.me/') ? 'call' : line.includes('chat.whatsapp.com/') ? 'group' : 'inventory_2'} />{line}</a> : line || <br />}</p>)}</div></section>
        <p className="pickup-recipients"><Icon name="mail" /><span>Envio individual para {preview.count} pedido(s) apto(s).<br /><small>Exemplo do primeiro pedido; nome, número e peças serão personalizados.</small></span></p>
      </>}
      {error && <p className="pickup-error" role="alert">{error}</p>}
      <footer className="pickup-footer">
        <button className="pickup-secondary" type="button" disabled={busy} onClick={() => { if (preview) { setPreview(null); setError(''); } else onClose(); }}>{preview && <Icon name="arrow_back" />}{preview ? 'Voltar' : 'Cancelar'}</button>
        <button className="pickup-primary" type="submit" disabled={busy || !info || !info.configured || !info.eligible}>{busy ? (preview ? 'Confirmando…' : 'Preparando…') : preview ? 'Enviar e-mails' : 'Confirmar'}<Icon name={preview ? 'send' : 'arrow_forward'} /></button>
      </footer>
    </form>
  </dialog>;
}
