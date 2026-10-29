import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function CampaignQrCode({ url, campaignCode, couponCode }: { url: string; campaignCode: string; couponCode?: string }) {
  const [result, setResult] = useState({ url: '', image: '', error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 1200, margin: 4, errorCorrectionLevel: 'M' })
      .then(image => { if (active) setResult({ url, image, error: '' }); })
      .catch(() => { if (active) setResult({ url, image: '', error: 'Não foi possível gerar o QR code.' }); });
    return () => { active = false; };
  }, [url, attempt]);
  const image = result.url === url ? result.image : '';
  const error = result.url === url ? result.error : '';
  const label = couponCode ? `Com cupom ${couponCode}` : 'Sem cupom';
  const filename = `qr-${campaignCode}-${couponCode ? `cupom-${couponCode}` : 'sem-cupom'}.png`.replace(/[^a-z0-9._-]/gi, '-');
  return <figure className="campaign-qr-option">
    <figcaption><strong>{label}</strong><span>{couponCode ? 'O desconto será aplicado conforme as regras do cupom.' : 'Abre a campanha sem preencher um cupom.'}</span></figcaption>
    {image ? <img src={image} alt={`QR code ${label.toLowerCase()}`} width={220} height={220} /> : <p role="status">{error || 'Gerando QR code…'}</p>}
    {image && <a className="outline-action" href={image} download={filename}>Baixar QR {couponCode ? 'com' : 'sem'} cupom<span className="material-symbols-rounded" aria-hidden="true">download</span></a>}
    {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}
  </figure>;
}
