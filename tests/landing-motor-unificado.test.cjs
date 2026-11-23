'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','landing');
const code=fs.readFileSync(path.join(root,'campanha.js'),'utf8');
const selim=fs.readFileSync(path.join(root,'index.html'),'utf8');
const tao=fs.readFileSync(path.join(root,'50tao.html'),'utf8');
test('todas as campanhas usam um único motor atualizado',()=>{
 for(const html of [selim,tao]){
  assert.match(html,/campanha\.js\?v=20261121-etapas1/);
  assert.match(html,/modelos\.js\?v=20261121-etapas1/);
  assert.match(html,/desafiogiro\.gmbd\.com\.br/);
  assert.doesNotMatch(html,/desafiogiro\.giromotosbikes\.com\.br/);
  assert.doesNotMatch(html,/R\$ 39,90|R\$ 44,90/);
 }
 assert.doesNotMatch(code,/desafiogiro\.giromotosbikes\.com\.br/);
 assert.doesNotThrow(()=>new Function(code));
});
const start=code.indexOf('function refLanding(){'),end=code.indexOf('function request(){');
assert(start>=0&&end>start,'motor comercial presente');
const core=code.slice(start,end);
function node(tag,cls,value){
 return {tag,cls,textContent:value||'',dataset:{},children:[],classList:{added:[],add(v){this.added.push(v)}},append(...v){this.children.push(...v)},replaceChildren(...v){this.children=v},setAttribute(k,v){this[k]=v}};
}
function render(opts={}){
 const config={portal:{id_desafio_lista:opts.vinculo||'166',modalidade:opts.modalidade||'CICLISMO'}};
 const state=node('p'),pricing=node('div');
 const ctas=Array.from({length:3},()=>Object.assign(node('a'),{dataset:{label:'Quero me inscrever'}}));
 const document={querySelector(s){return s==='#inscricao-status'?state:s==='.pricing-lots'?pricing:null},querySelectorAll(s){return s==='[data-cta]'?ctas:[]}};
 const $=s=>document.querySelector(s),element=node;
 const date=s=>({'2026-11-15':'15/11/2026','2026-10-21':'21/10/2026'}[s]||'não informado');
 const d={status:'ABERTO',vagasDisponiveis:12,desafio:{id:opts.id||'166',modalidade:opts.modalidadeApi||opts.modalidade||'CICLISMO',inicio:'2026-10-21'},loteAtual:1,lotes:[{numero:1,valor:opts.valor??65,inicio:'2026-10-21',fim:'2026-11-15'},{numero:2,valor:75,inicio:'2026-11-16',fim:'2026-11-30'}],...opts.payload};
 new Function('config','document','$','element','date','d','location',core+';commercial(d)')(config,document,$,element,date,d,{search:opts.search||''});
 return {state:state.textContent,cards:pricing.children,ctas};
}
test('preços e datas são exibidos conforme API, sem valores fixos',()=>{
 const a=render(),b=render({valor:89.5});
 assert.match(a.state,/Inscrições abertas/);assert.equal(a.cards.length,2);
 assert.equal(a.cards[0].children[1].textContent,new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(65));
 assert.equal(b.cards[0].children[1].textContent,new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(89.5));
 assert.match(a.cards[0].children[2].textContent,/21\/10\/2026/);
 assert(a.cards[0].classList.added.includes('is-current'));
});
test('modalidade Caminhada/Corrida só abre com ID e modalidade corretos',()=>{
 assert.match(render({vinculo:'167',id:'167',modalidade:'CAMINHADA_CORRIDA'}).state,/Inscrições abertas/);
 assert.doesNotMatch(render({id:'999'}).state,/Inscrições abertas/);
 assert.doesNotMatch(render({modalidadeApi:'CAMINHADA_CORRIDA'}).state,/Inscrições abertas/);
});
test('esgotado, encerrado ou API indisponível impedem propaganda de abertura',()=>{
 for(const payload of [{vagasDisponiveis:0},{status:'ESGOTADO'},{status:'ENCERRADO'},{status:'INDISPONIVEL'}]){
  const r=render({payload});
  assert.doesNotMatch(r.state,/Inscrições abertas/);
  assert(r.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/'&&/Consultar inscrições/.test(a.textContent)));
 }
});
test('API antiga ou parcial sem vagas confirmadas nao anuncia inscricao aberta',()=>{
 for(const payload of [
  {vagasDisponiveis:null},
  {vagasDisponiveis:undefined},
  {vagasDisponiveis:''},
  {vagasDisponiveis:'invalido'},
  {vagasDisponiveis:-1},
  {vagasDisponiveis:1.5}
 ]){
  const r=render({payload});
  assert.doesNotMatch(r.state,/Inscrições abertas/,JSON.stringify(payload));
  assert(r.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/'),JSON.stringify(payload));
 }
 const r=render({payload:{vagasDisponiveis:'3'}});
 assert.match(r.state,/Inscrições abertas/);
});
test('sem lote válido não mantém preço antigo nem anuncia abertura',()=>{
 const r=render({payload:{lotes:[{numero:1,valor:null}]}});
 assert.doesNotMatch(r.state,/Inscrições abertas/);
 assert.equal(r.cards[0].children[0].textContent,'Consulte os valores no Portal Giro');
});
test('link direto só é aceito no domínio seguro do Portal',()=>{
 const valid=render({payload:{url_inscricao:'https://desafiogiro.gmbd.com.br/?desafio=166'}});
 assert(valid.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?desafio=166'));
 for(const candidate of ['https://site-falso.test/','javascript:alert(1)','http://desafiogiro.gmbd.com.br/?desafio=166','https://desafiogiro.gmbd.com.br/?desafio=999']){
  const unsafe=render({payload:{url_inscricao:candidate}});
  assert(unsafe.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/'));
 }
});

test('REF da landing sobrevive a inscricao aberta e consulta de inscricoes',()=>{
 const campanha=render({search:'?ref=1145',payload:{url_inscricao:'https://desafiogiro.gmbd.com.br/?desafio=166'}});
 assert(campanha.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?desafio=166&ref=1145'));
 const semVaga=render({search:'?ref=1145',payload:{vagasDisponiveis:0}});
 assert(semVaga.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?ref=1145'));
});
test('REF preserva dominio seguro e validacao do desafio',()=>{
 const seguro=render({search:'?ref=CODIGO_DIVULGADOR',payload:{url_inscricao:'https://site-falso.test/?desafio=166'}});
 assert(seguro.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?ref=CODIGO_DIVULGADOR'));
 const idErrado=render({search:'?ref=1145',payload:{url_inscricao:'https://desafiogiro.gmbd.com.br/?desafio=999'}});
 assert(idErrado.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?ref=1145'));
 const semRef=render({search:'?utm_campaign=teste',payload:{url_inscricao:'https://desafiogiro.gmbd.com.br/?desafio=166'}});
 assert(semRef.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?desafio=166'));
});
test('REF invalida nao pode injetar URL nem codigo excessivo',()=>{
 for(const ref of ['%0D%0Afoo','%3Fdesafio%3D999','%3Cscript%3E','A'.repeat(101)]){
  const r=render({search:'?ref='+ref,payload:{url_inscricao:'https://desafiogiro.gmbd.com.br/?desafio=166'}});
  assert(r.ctas.every(a=>a.href==='https://desafiogiro.gmbd.com.br/?desafio=166'));
 }
});
