import { useEffect, useRef, useState } from 'react';
import { fetchEmailHistory } from '../api';
import type { EmailHistory } from '../api';

const labels: Record<string, string> = { pending: 'Na fila', sending: 'Enviando', sent: 'Aceito pelo servidor', failed: 'Falha', cancelled: 'Cancelado', uncertain: 'Conferir resultado' };
const Icon = ({ name }: { name: string }) => <span className="material-symbols-rounded" aria-hidden="true">{name}</span>;
const date = (value: string) => new Date(value).toLocaleString('pt-BR');
export function EmailHistoryDialog({ code, title, onClose, onOpenOrder }: { code: string; title: string; onClose: () => void; onOpenOrder: (number: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<EmailHistory | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    let active = true;
    setBusy(true); setError(''); setData(null);
    fetchEmailHistory(code, query, status, page).then(result => {
      if (active) { setData(result); setSelectedId(id => result.items.some(item => item.id === id) ? id : result.items[0]?.id || ''); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [code, query, status, page, version]);
  const selected = data?.items.find(item => item.id === selectedId);
  return <dialog ref={dialog} className="pickup-dialog email-history-dialog" aria-labelledby="email-history-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="pickup-heading"><span className="pickup-heading-icon"><Icon name="history" /></span><div><h2 id="email-history-title">E-mails dos pedidos</h2><p>{title}</p></div><button className="pickup-close" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button></header>
    <p className="pickup-hint"><Icon name="info" />Aceito pelo servidor não confirma recebimento ou leitura.</p>
    <div className="email-history-filters">
      <label><span className="sr-only">Buscar pedido, nome ou e-mail</span><input type="search" placeholder="Buscar pedido, nome ou e-mail" maxLength={160} value={search} onChange={e => setSearch(e.target.value)} /></label>
      <select aria-label="Filtrar por status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Todos os status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="pickup-launch" aria-label="Atualizar histórico" title="Atualizar histórico" disabled={busy} onClick={() => setVersion(v => v + 1)}><Icon name="refresh" /></button>
    </div>
    {error && <p className="pickup-error" role="alert">{error}</p>}
    {busy && <p role="status">Carregando histórico…</p>}
    {data && <>
      <div className="email-history-summary">{data.summary.map(item => <span key={item.status}>{labels[item.status] || item.status} <strong>{item.count}</strong></span>)}</div>
      <div className="email-history-layout">
        <section aria-label="Lista de e-mails">
          <div className="email-history-list">{data.items.map(item => <button key={item.id} className={`email-history-row ${item.id === selectedId ? 'is-selected' : ''}`} aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
            <span><strong>{item.orderNumber}</strong><span>{item.customerName}</span><small>{item.recipient}</small><small>{date(item.sentAt || item.createdAt)}</small></span>
            <span><small>{item.type === 'pickup_ready' ? 'Retirada' : 'Pagamento'}</small><span className={`email-status email-status-${item.status}`}>{labels[item.status] || item.status}</span><Icon name="visibility" /></span>
          </button>)}</div>
          {!data.items.length && <p className="email-history-empty">Nenhum e-mail encontrado.</p>}
          <nav className="email-history-pagination" aria-label="Paginação do histórico"><button className="pickup-close" aria-label="Página anterior" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}><Icon name="chevron_left" /></button><span>{data.total} registro(s) · Página {data.page} de {data.pages}</span><button className="pickup-close" aria-label="Próxima página" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}><Icon name="chevron_right" /></button></nav>
        </section>
        <section className="email-history-content" aria-label="Conteúdo do e-mail">
          {selected ? <><div className="email-history-detail-heading"><h3>{selected.orderNumber}</h3><button className="pickup-secondary" onClick={() => onOpenOrder(selected.orderNumber)}>Abrir pedido<Icon name="open_in_new" /></button></div>
            <dl><dt>Destinatário</dt><dd>{selected.recipient}</dd><dt>Status</dt><dd>{labels[selected.status]}</dd><dt>Criado em</dt><dd>{date(selected.createdAt)}</dd>{selected.sentAt && <><dt>Aceito em</dt><dd>{date(selected.sentAt)}</dd></>}<dt>Tentativas</dt><dd>{selected.attempts}</dd></dl>
            {selected.text ? <article className="pickup-message"><small>ASSUNTO</small><h3>{selected.subject}</h3><p className="email-history-text">{selected.text}</p></article> : <p className="email-history-empty">O conteúdo deste e-mail não foi armazenado. Os dados de envio estão disponíveis acima.</p>}
          </> : <p className="email-history-empty">Selecione um e-mail para conferir os detalhes.</p>}
        </section>
      </div>
    </>}
    <footer className="pickup-footer"><button className="pickup-secondary" onClick={onClose}>Fechar</button></footer>
  </dialog>;
}
