import { useEffect, useId, useRef, useState } from 'react';
import { normalizeCustomerEmail, parseWhatsapp } from '../../shared/contact.mjs';
import { formattedWhatsapp } from '../phone';

type Props = {
  kind: 'phone' | 'email';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
};

export function ContactInput({ kind, value, onChange, placeholder, name, id, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [touched, setTouched] = useState(false);
  const error = kind === 'phone' ? parseWhatsapp(value).error ?? ''
    : normalizeCustomerEmail(value) ? '' : 'Informe um e-mail completo, como nome@dominio.com.br.';
  useEffect(() => { ref.current?.setCustomValidity(error); }, [error]);
  function change(next: string) {
    const nextError = kind === 'phone' ? parseWhatsapp(next).error ?? ''
      : normalizeCustomerEmail(next) ? '' : 'Informe um e-mail completo, como nome@dominio.com.br.';
    ref.current?.setCustomValidity(nextError);
    onChange(next);
  }
  return <>
    <input ref={ref} id={id} name={name} disabled={disabled} type={kind === 'phone' ? 'tel' : 'email'}
      autoComplete={kind === 'phone' ? 'tel' : 'email'} inputMode={kind === 'phone' ? 'tel' : 'email'}
      placeholder={placeholder} value={value} required maxLength={kind === 'phone' ? 25 : 254}
      aria-invalid={touched && Boolean(error)} aria-describedby={touched && error ? errorId : undefined}
      onChange={event => change(event.target.value)} onInvalid={() => setTouched(true)}
      onBlur={() => { setTouched(true); if (!error) change(kind === 'phone' ? formattedWhatsapp(value) : normalizeCustomerEmail(value)); }} />
    {touched && error && <small className="contact-field-error" id={errorId} role="alert">{error}</small>}
  </>;
}
