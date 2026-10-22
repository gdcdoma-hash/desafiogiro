'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','landing');
const code=fs.readFileSync(path.join(root,'campanha.js'),'utf8');
const selim=fs.readFileSync(path.join(root,'index.html'),'utf8');
const tao=fs.readFileSync(path.join(root,'50tao.html'),'utf8');
const shared='src="/landing/campanha.js?v=20261022-unificado1"';

test('duas campanhas executam exatamente o mesmo motor',()=>{
 assert(selim.includes(shared));assert(tao.includes(shared));
 assert(!tao.includes('src="/landing/50tao.js"'));
 for(const html of [selim,tao])for(const id of ['campaign-load','inscricao-status'])
   assert(html.includes('id="'+id+'"'));
 assert.doesNotThrow(()=>new Function(code));
});

const start=code.indexOf('function commercial(d){'),end=code.indexOf('function request(){');
assert(start>=0&&end>start,'commercial function present');
const core=code.slice(start,end);

function render({status='ABERTO',id='166',vinculo='166',modalidade='CICLISMO',valor=39.9}={}){
 const statusEl={textContent:''},dates={1:{textContent:''},2:{textContent:''}};
 const lotes={1:{classList:{remove(){},toggle(){}}},2:{classList:{remove(){},toggle(){}}}};
 const ctas=Array.from({length:3},()=>({dataset:{label:'Quero me inscrever'},setAttribute(k,v){this[k]=v;}}));
 const get=sel=>{
   if(sel==='#inscricao-status')return statusEl;
   const p=sel.match(/^\[data-periodo="(\d)"\]$/);
   const l=sel.match(/^\[data-lote="(\d)"\]$/);
   return p?dates[p[1]]:l?lotes[l[1]]:null;
 };
 const document={
   querySelector:get,
   querySelectorAll(sel){return sel==='[data-cta]'?ctas:sel==='[data-periodo]'?Object.values(dates):sel==='[data-lote]'?Object.values(lotes):[];}
 };
 const config={portal:{id_desafio_lista:vinculo,modalidade}};
 const text=(sel,v)=>{const el=get(sel);if(el)el.textContent=v;};
 const date=s=>({ '2026-11-15':'15/11/2026','2026-10-21':'21/10/2026' }[s]||'não informado');
 new Function('document','config','text','date','$','d',core+';commercial(d)')(
   document,config,text,date,get,{
     status,desafio:{id,modalidade},loteAtual:1,
     lotes:[{numero:1,valor,inicio:'2026-10-21',fim:'2026-11-15'}]
   });
 return {msg:statusEl.textContent,ctas,periodo:dates[1].textContent};
}

test('Selim abre com vínculo e lote correto',()=>{
 const out=render();assert.match(out.msg,/Inscrições abertas/);
 assert.match(out.periodo,/21\/10\/2026/);
 assert(out.ctas.every(x=>x.textContent==='Quero me inscrever'));
});
test('50tão abre com vínculo e modalidade correta',()=>{
 const out=render({id:'167',vinculo:'167',modalidade:'CAMINHADA_CORRIDA'});
 assert.match(out.msg,/Inscrições abertas/);
});
test('modo falha mantém CTA funcionando sem anunciar abertura não verificada',()=>{
 const out=render({status:'INDISPONIVEL'});
 assert.doesNotMatch(out.msg,/Inscrições abertas/);
 assert(out.ctas.every(x=>x.href==='https://desafiogiro.giromotosbikes.com.br/'&&x['aria-disabled']==='false'));
 assert(out.ctas.every(x=>/Consultar inscrições/.test(x.textContent)));
});
test('ID ou modalidade divergente não libera inscrição',()=>{
 assert.doesNotMatch(render({id:'999'}).msg,/Inscrições abertas/);
 assert.doesNotMatch(render({modalidade:'CAMINHADA_CORRIDA'}).msg,/Inscrições abertas/);
});
test('lote com valor divergente e inscrição encerrada não liberam estado ABERTO',()=>{
 assert.doesNotMatch(render({valor:99}).msg,/Inscrições abertas/);
 assert.doesNotMatch(render({status:'ENCERRADO'}).msg,/Inscrições abertas/);
});
