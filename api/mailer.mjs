import { config } from './config.mjs';
import { createMailer } from './smtp-transport.mjs';
export function mailerConfigured() { const {host,user,password,from}=config.smtp; return Boolean(host&&user&&password&&from); }
export async function sendMail(message) {
 if(!mailerConfigured()) throw Object.assign(new Error('SMTP não configurado.'),{deliveryUncertain:false});
 return createMailer(config.smtp,config.publicAppUrl)(message);
}
