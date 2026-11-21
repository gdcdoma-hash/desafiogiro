'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engine=fs.readFileSync(path.join(__dirname,'..','landing','campanha.js'),'utf8');

test('aba oculta nao solicita a API e retorno ao foco consulta uma vez',()=>{
 let hidden=true,network=0,timers=[],onVisibility;
 const load={hidden:false,textContent:'Carregando'};
 const document={
  get hidden(){return hidden},
  querySelector:(sel)=>sel==='#campaign-load'?load:null,
  createElement:()=>({remove(){},src:'',onerror:null}),
  head:{append(script){network++;assert.match(script.src,/api=landing-campanha-v1/)}},
  addEventListener:(type,fn)=>{if(type==='visibilitychange')onVisibility=fn}
 };
 const window={};
 const setTimeoutFake=(fn,ms)=>{timers.push({fn,ms});return timers.length};
 const clearTimeoutFake=()=>{};
 const run=new Function('document','window','location','URL','URLSearchParams','setTimeout','clearTimeout',engine);
 run(document,window,{pathname:'/desafios/selim/',search:''},URL,URLSearchParams,setTimeoutFake,clearTimeoutFake);
 assert.equal(network,0,'Nao requisitar com a aba oculta');
 assert.equal(timers.length,1);
 assert.equal(timers[0].ms,60000);
 assert.equal(typeof onVisibility,'function');
 hidden=false;
 onVisibility();
 assert.equal(network,1,'Primeira consulta ao reabrir a aba');
 onVisibility();
 assert.equal(network,1,'Reentrada nao duplica consulta pendente');
});
