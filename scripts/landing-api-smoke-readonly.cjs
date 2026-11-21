'use strict';
/*
 * Diagnostico publico, somente LEITURA, do deployment Apps Script PROD.
 * Nao imprime dados recebidos, URLs privadas ou chaves.
 * Pode executar em GitHub Actions publico, sem secrets.
 */
const assert=require('node:assert/strict');
const endpoint='https://script.google.com/macros/s/AKfycbx3I_pc35_LWv1SpeEJbJ_3pq9aLE1lIc6tE4BccQGdD18nyKzmw5quivht3zOEdyCP/exec';
const cases=[['selim','166','CICLISMO'],['50tao','167','CAMINHADA_CORRIDA']];
const allowedStatuses=new Set(['ABERTO','INDISPONIVEL','ESGOTADO','EM_BREVE','ENCERRADO','PAUSADO','NAO_CADASTRADO','REQUISICAO_INVALIDA']);
async function checkCampaign(slug,expectedId,expectedMode){
 const callback='dgmbLanding_1795260000000_'+(slug==='selim'?'1':'2');
 const url=new URL(endpoint);
 url.searchParams.set('api','landing-campanha-v1');
 url.searchParams.set('campanha',slug);
 url.searchParams.set('callback',callback);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 let response,raw;
 try{
  response=await fetch(url,{signal:controller.signal,redirect:'follow',headers:{Accept:'text/javascript, application/javascript, application/json'}});
  raw=await response.text();
 }catch(e){
  throw Error('API_REDE_OU_TIMEOUT: '+String(e&&e.name||'Falha'));
 }finally{clearTimeout(timeout)}
 assert.equal(response.status,200,'HTTP_NOT_OK:'+response.status);
 assert(raw.length<160000,'API_RESPOSTA_EXCESSIVA');
 const safeCallback=callback.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const match=raw.match(new RegExp('^\\s*'+safeCallback+'\\(([\\s\\S]*)\\);?\\s*$'));
 assert(match,'JSONP_AUSENTE: resposta nao segue contrato publico ou script inacessivel');
 let data;
 try{data=JSON.parse(match[1])}catch(_){throw Error('JSONP_INVALIDO')}
 assert(data&&typeof data==='object'&&!Array.isArray(data),'API_OBJETO_INVALIDO');
 assert.equal(data.status,'OK','CAMPANHA_NAO_PUBLICADA_OU_API_NAO_IMPLANTADA');
 const c=data.campanha||{},i=data.inscricoes||{},d=i.desafio||{};
 assert.equal(c.id,slug,'CAMPANHA_DIVERGENTE');
 assert.equal(String(c.portal&&c.portal.id_desafio_lista),expectedId,'VINCULO_CAMPANHA_INVALIDO');
 assert.equal(String(c.portal&&c.portal.modalidade),expectedMode,'MODALIDADE_CAMPANHA_INVALIDA');
 assert.equal(String(d.id),expectedId,'VINCULO_INSCRICAO_INVALIDO');
 assert.equal(String(d.modalidade),expectedMode,'MODALIDADE_INSCRICAO_INVALIDA');
 assert(allowedStatuses.has(i.status),'STATUS_INSCRICAO_INVALIDO');
 // Dados comerciais devem sempre vir de PixLotes, nunca de chaves PIX.
 const forbidden=new Set(['cpf','chave_pix','status_pagamento','id_dgmb','password','senha','token','endpoint','base64']);
 const walk=(obj)=>{
  if(!obj||typeof obj!=='object')return;
  for(const [key,value] of Object.entries(obj)){
   assert(!forbidden.has(key.toLowerCase()),'CAMPO_PRIVADO_NA_API:'+key);
   if(value&&typeof value==='object')walk(value);
  }
 };
 console.log(JSON.stringify({campanha:slug,api:'OK',situacao:i.status,desafio:d.id,modalidade:d.modalidade,
  vagasConfirmadas:Number.isInteger(Number(i.vagasDisponiveis))&&i.vagasDisponiveis!==null&&i.vagasDisponiveis!==''}));
 walk(data);
 if(i.status==='ABERTO'){
  assert(Number.isInteger(Number(i.vagasDisponiveis))&&Number(i.vagasDisponiveis)>0,'ABERTO_SEM_VAGAS_CONFIRMADAS');
  const list=Array.isArray(i.lotes)?i.lotes:[];
  const active=list.find(l=>Number(l.numero)===Number(i.loteAtual));
  assert(active&&Number.isFinite(Number(active.valor))&&Number(active.valor)>0,'ABERTO_SEM_LOTE');
 }
 
}
(async()=>{
 let failed=false;
 for(const [slug,id,mode] of cases){
  try{await checkCampaign(slug,id,mode)}
  catch(e){failed=true;console.error('FALHA_CONTRATO '+slug+': '+String(e&&e.message||e).slice(0,180))}
 }
 if(failed)process.exitCode=1;
})().catch(e=>{console.error('ERRO_TESTE '+String(e&&e.message||e).slice(0,140));process.exitCode=1});
