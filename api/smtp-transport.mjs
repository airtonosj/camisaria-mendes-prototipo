import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

export function smtpOptions(smtp, publicAppUrl) {
  return {
    host:smtp.host, port:smtp.port, secure:smtp.port===465,
    requireTLS:smtp.port!==465,
    auth:{user:smtp.user,pass:smtp.password},
    name:new URL(publicAppUrl).hostname,
    connectionTimeout:15000, greetingTimeout:15000, socketTimeout:15000,
    tls:{rejectUnauthorized:true},
    disableFileAccess:true, disableUrlAccess:true,
  };
}

/** Classify only demonstrably pre-DATA failures as safe to retry. */
export function deliveryIsUncertain(error) {
  // Nodemailer also labels a disconnect AFTER DATA as CONN. That label alone
  // cannot establish that the message was never accepted.
  if (error.code === 'EDNS' || error.code === 'ETLS' || error.syscall === 'connect') return false;
  return !['EHLO','HELO','STARTTLS','AUTH','AUTH LOGIN','AUTH PLAIN','MAIL FROM','RCPT TO'].includes(error.command);
}

/** @param {object} smtp @param {string} publicAppUrl */
export function createMailer(smtp, publicAppUrl, createTransport=nodemailer.createTransport) {
  const transport=createTransport(smtpOptions(smtp,publicAppUrl));
  return async ({to,subject,text,messageId})=>{
    if(!/^[^@\s]+@[^@\s]+$/.test(String(to))||/[\r\n]/.test(String(to)))throw Object.assign(new Error('Destinatário de e-mail inválido.'),{deliveryUncertain:false});
    if(/[\r\n]/.test(String(subject)))throw Object.assign(new Error('Assunto de e-mail inválido.'),{deliveryUncertain:false});
    const safeId=/^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$/.test(String(messageId??''))?messageId:`${randomUUID()}@${smtp.from.split('@')[1]??'camisaria-mendes'}`;
    try {
      const result=await transport.sendMail({from:{name:smtp.fromName,address:smtp.from},to,subject,text,messageId:`<${safeId}>`});
      if(!result.accepted?.length)throw Object.assign(new Error('SMTP recusou o destinatário.'),{command:'RCPT TO'});
    } catch(error) {
      error.deliveryUncertain=deliveryIsUncertain(error);
      throw error;
    }
  };
}
