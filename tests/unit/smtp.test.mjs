import test from 'node:test';
import assert from 'node:assert/strict';
import { SMTPServer } from 'smtp-server';
import nodemailer from 'nodemailer';
import { once } from 'node:events';
import { createMailer, deliveryIsUncertain, smtpOptions } from '../../api/smtp-transport.mjs';
const smtp={host:'127.0.0.1',port:587,user:'test',password:'test',from:'sender@example.test',fromName:'Camisaria'};
test('TLS, certificate checks and timeouts remain mandatory',()=>{
 assert.equal(smtpOptions(smtp,'https://example.test').requireTLS,true);
 assert.equal(smtpOptions({...smtp,port:465},'https://example.test').secure,true);
 assert.equal(smtpOptions(smtp,'https://example.test').tls.rejectUnauthorized,true);
});
test('failures after DATA or at an unknown stage remain uncertain',()=>{
 for(const command of ['AUTH','RCPT TO','STARTTLS'])assert.equal(deliveryIsUncertain({command}),false);
 for(const command of ['CONN','DATA',undefined])assert.equal(deliveryIsUncertain({command}),true);
});
for(const failure of ['auth','recipient','timeout','success','accepted-disconnect','disconnect-during','disconnect'])test(`local SMTP: ${failure}`,async()=>{
 let received='';
 const server=new SMTPServer({disabledCommands:['STARTTLS'],allowInsecureAuth:true,closeTimeout:100,logger:false,
  onAuth(auth,session,callback){if(failure==='timeout')return;callback(failure==='auth'?new Error('Rejected'):null,{user:'test'});},
  onRcptTo(address,session,callback){callback(failure==='recipient'?new Error('Rejected'):null);},
  onData(stream,session,callback){stream.on('data',chunk=>{received+=chunk;if(failure==='disconnect-during')for(const connection of server.connections)connection._socket.destroy();});stream.on('end',()=>{if(failure==='disconnect'){for(const connection of server.connections)connection._socket.destroy();}else {callback();if(failure==='accepted-disconnect')setTimeout(()=>{for(const connection of server.connections)connection._socket.destroy();},25);}});}
 });
 server.on('error',()=>{});server.listen(0,'127.0.0.1');await once(server.server,'listening');
 const send=createMailer({...smtp,port:server.server.address().port},'https://example.test',options=>nodemailer.createTransport({...options,requireTLS:false,ignoreTLS:true,socketTimeout:failure==='timeout'?200:3000}));
 try {
  const message={to:'buyer@example.test',subject:'Confirmação',text:'Olá, sua compra está pronta.',messageId:'stable@example.test'};
  if(['success','accepted-disconnect'].includes(failure)){await send(message);assert.match(received,/<stable@example.test>/);assert.match(received,/Subject:/);}
  else await assert.rejects(send(message),error=>error.deliveryUncertain===(failure.startsWith('disconnect')||failure==='timeout') && (failure==='auth'?error.code==='EAUTH':failure==='recipient'?error.command==='RCPT TO':failure==='timeout'?error.code==='ETIMEDOUT':error.code==='ECONNECTION'));
 } finally {await new Promise(resolve=>server.close(resolve));}
});
