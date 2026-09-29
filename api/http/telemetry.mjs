import { randomUUID } from 'node:crypto';
const roots=new Set(['auth','campaigns','orders','payments','settings','sizes','health','license','reports','uploads','video-uploads','account']);
export function routeLabel(raw) {
 try {
  const parts=new URL(raw,'http://localhost').pathname.split('/').filter(Boolean);
  if(parts[0]!=='api')return parts[0]==='uploads'?'/uploads/:file':'/frontend';
  const admin=parts[1]==='admin';const root=parts[admin?2:1];
  return roots.has(root)?`/api/${admin?'admin/':''}${root}`:'/api/other';
 }catch{return '/invalid';}
}
export function observeRequest(request,response,log=console.log) {
 const requestId=randomUUID(),start=performance.now();
 response.setHeader('X-Request-ID',requestId);
 response.once('finish',()=>log(JSON.stringify({event:'request',requestId,method:request.method,route:routeLabel(request.url),status:response.statusCode,durationMs:Math.round(performance.now()-start),...(response.errorCode?{code:response.errorCode}:{})})));
 return requestId;
}
