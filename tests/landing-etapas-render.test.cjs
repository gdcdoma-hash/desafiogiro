'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'..','landing','campanha.js'),'utf8');
const start=code.indexOf('function renderStages(c){');
const end=code.indexOf('function apply(c){');
assert(start>=0&&end>start,'renderStages deve existir no motor publico');

function createFixture(){
 let inserted=null,removed=0;
 function element(tag,cls,value){
  const node={
   tag,className:cls||'',textContent:value||'',children:[],id:'',attributes:{},
   classList:{values:[],add(name){this.values.push(name)}},
   append(...children){this.children.push(...children)},
   setAttribute(key,value){this.attributes[key]=value},
   remove(){inserted=null;removed++}
  };
  return node;
 }
 const parent={insertBefore(node,anchor){assert.equal(anchor,steps);inserted=node}};
 const steps={parentNode:parent};
 const $=sel=>sel==='#campaign-stages'?inserted:sel==='.steps-section'?steps:null;
 const asset=v=>String(v||'').startsWith('https://')?v:String(v||'');
 const render=new Function('$','element','asset',code.slice(start,end)+';return renderStages;')($,element,asset);
 return {render,inserted:()=>inserted,removed:()=>removed};
}
const stage=(n)=>({titulo:'Etapa '+n,descricao:'Conquista '+n,imagem:n===2?'https://example.org/stage.webp':'',imagem_alt:'Imagem '+n});
test('campanhas anteriores sem etapas nao criam bloco adicional',()=>{
 const f=createFixture();f.render({etapas:[]});assert.equal(f.inserted(),null);
});
test('uma etapa cria um card centralizado',()=>{
 const f=createFixture();f.render({etapas:[stage(1)]});
 const section=f.inserted();assert(section);
 const grid=section.children[0].children[2];
 assert(grid.classList.values.includes('single'));
 assert.equal(grid.children.length,1);
 assert.equal(grid.children[0].children[0].children[0].textContent,'Etapa 1 de 1');
});
test('duas etapas exibem cards independentes e imagens com alt',()=>{
 const f=createFixture();f.render({etapas:[stage(1),stage(2)]});
 const grid=f.inserted().children[0].children[2];
 assert.equal(grid.children.length,2);
 assert(!grid.classList.values.includes('single'));
 assert.equal(grid.children[1].children[0].alt,'Imagem 2');
 assert.equal(grid.children[1].children[1].children[0].textContent,'Etapa 2 de 2');
});
test('remover etapas apaga o bloco antigo',()=>{
 const f=createFixture();
 f.render({etapas:[stage(1),stage(2)]});
 f.render({etapas:[]});
 assert.equal(f.inserted(),null);
 assert.equal(f.removed(),1);
});
