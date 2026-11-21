(()=>{'use strict';
const endpoint='https://script.google.com/macros/s/AKfycbx3I_pc35_LWv1SpeEJbJ_3pq9aLE1lIc6tE4BccQGdD18nyKzmw5quivht3zOEdyCP/exec';
const slug=(location.pathname.match(/^\/desafios\/([a-z0-9-]+)\/?$/)||[])[1]||new URLSearchParams(location.search).get('campanha');
const $=s=>document.querySelector(s),load=$('#campaign-load');let revision='',config,seq=0,timer,inFlight=false;
function text(s,v){const e=$(s);if(e)e.textContent=v||'';}function element(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;}
function asset(v){if(/^https:\/\//.test(v))return v;if(/^[A-Za-z0-9][A-Za-z0-9._-]*\.(webp|png|jpe?g|mp4|webm)$/i.test(v))return '/landing/assets/'+v;return '';}
function heading(s,a,b){const e=$(s);if(e){e.replaceChildren(document.createTextNode(a+' '),element('em','',b));}}
function image(s,src,alt){document.querySelectorAll(s).forEach(e=>{e.src=asset(src);e.alt=alt||'';});}
function apply(c){config=c;document.title=c.nome+' | Desafio Giro';heading('#hero-title',c.texto.hero_titulo,c.texto.hero_destaque);text('.hero-lead',c.texto.hero_subtitulo);text('.hero-description',c.texto.hero_descricao);text('.hero-footnote',c.texto.nota_portal);text('.closing-copy small',c.texto.nota_portal);text('.hero-copy .eyebrow','DESAFIO GIRO · '+c.modalidade.toUpperCase());
const sections=[['#intro-heading','intro_titulo','intro_destaque'],['#medal-title','medalha_titulo','medalha_destaque'],['#closing-title','final_titulo','final_destaque']];sections.forEach(([sel,a,b])=>heading(sel,c.texto[a],c.texto[b]));
text('.intro .eyebrow',c.texto.intro_chamada);text('.intro-grid>p',c.texto.intro_texto);text('.steps-section .section-heading p',c.texto.como_funciona);text('.medal-content>p',c.texto.medalha_descricao);text('.gallery-heading p',c.texto.galeria_descricao);text('.quote-kicker',c.nome.toUpperCase());text('.quote-inner>p',c.texto.frase_motivacional);text('.faq-grid>div:first-child>p',c.texto.faq_intro);text('.closing-copy>p',c.texto.final_texto);text('.footer-tagline',c.frase_marca);
const colors={fundo:'--bg',fundo_secundario:'--bg2',destaque:'--gold',destaque_escuro:'--gold2',destaque_claro:'--gold-light',fundo_claro:'--light'};Object.entries(colors).forEach(([k,v])=>{if(/^#[0-9a-f]{6}$/i.test(c.cores[k]))document.documentElement.style.setProperty(v,c.cores[k]);});
image('.hero-medal,.closing-image img',c.imagens.principal,c.imagens.principal_alt);image('.medal-card img',c.imagens.detalhe,c.imagens.detalhe_alt);const background=asset(c.imagens.cenario);$('.hero-landscape').style.backgroundImage=background?'url("'+background.replaceAll('"','%22')+'")':'';text('.hero-art-caption',c.frase_marca);
const open=$('#open-gallery');open.dataset.image=asset(c.imagens.detalhe);open.dataset.alt=c.imagens.detalhe_alt;
const gallery=$('.gallery-grid');gallery.replaceChildren();c.galeria.forEach((g,i)=>{const btn=element('button','gallery-item'+(i===0?' gallery-item-primary':'')+(i===c.galeria.length-1?' gallery-item-campaign':''));btn.type='button';btn.dataset.image=asset(g.arquivo);btn.dataset.alt=g.alt;const im=element('img');im.src=asset(g.arquivo);im.alt=g.alt;im.loading='lazy';btn.append(im,element('span','',g.legenda+' ↗'));gallery.append(btn);});
const faq=$('.faq-list');faq.replaceChildren();c.perguntas.forEach(g=>{const d=element('details'),s=element('summary','',g.pergunta),plus=element('span','','+');plus.setAttribute('aria-hidden','true');s.append(plus);const a=element('div','faq-answer');g.resposta.split(/\n\n/).forEach(p=>a.append(element('p','',p)));d.append(s,a);faq.append(d);});
const highlights=$('.highlights-grid');highlights.replaceChildren();c.destaques.forEach((x,i)=>{const item=element('div','highlight'),copy=element('div');copy.append(element('strong','',x.titulo),element('p','',x.descricao));item.append(element('div','highlight-icon',String(i+1).padStart(2,'0')),copy);highlights.append(item);});
const steps=$('.steps-grid');steps.replaceChildren();c.passos.forEach((x,i)=>{const li=element('li');li.append(element('span','step-num',String(i+1).padStart(2,'0')),element('span','step-symbol',x.icone),element('h3','',x.titulo),element('p','',x.descricao));steps.append(li);});
const features=$('.medal-features');features.replaceChildren();c.caracteristicas_medalha.forEach(x=>{const li=element('li'),copy=element('div');copy.append(element('strong','',x.titulo),element('span','',x.descricao));li.append(element('span','feature-mark','◇'),copy);features.append(li);});
document.querySelectorAll('[data-cta]').forEach(a=>{a.dataset.label=a.dataset.cta==='final'?c.botoes.final:a.dataset.cta==='passos'?c.botoes.secundario:c.botoes.principal;});
const canonical=$('link[rel=canonical]');canonical.href='https://desafiogiro.gmbd.com.br/desafios/'+slug+'/';document.querySelector('meta[name=description]').content=c.seo_descricao;document.querySelector('meta[property="og:title"]').content=c.nome+' | Desafio Giro';document.querySelector('meta[property="og:url"]').content=canonical.href;document.querySelector('meta[property="og:image"]').content=new URL(asset(c.imagens.compartilhamento),location.origin).href;document.querySelector('meta[property="og:description"]').content=c.seo_descricao;
}
function date(v){return /^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/'):'não informado';}
function portalUrl(candidate,expectedId){
 const fallback='https://desafiogiro.gmbd.com.br/';
 if(typeof candidate!=='string'||!candidate.trim())return fallback;
 try{
  const url=new URL(candidate,fallback);
  if(url.protocol!=='https:'||url.hostname!=='desafiogiro.gmbd.com.br'||url.username!==''||url.password!=='')return fallback;
  for(const key of ['desafio','id_desafio','idDesafio']){
   if(url.searchParams.has(key)&&String(url.searchParams.get(key))!==String(expectedId||''))return fallback;
  }
  return url.href;
 }catch(error){return fallback;}
}
function commercial(d){
 d=d||{};
 const state=$('#inscricao-status'),portal=config&&config.portal||{};
 const challenge=d.desafio||{},status=String(d.status||'INDISPONIVEL').toUpperCase();
 const all=Array.isArray(d.lotes)?d.lotes:[];
 const lots=all.filter(l=>l&&Number.isInteger(Number(l.numero))&&Number(l.numero)>0&&Number.isFinite(Number(l.valor))&&Number(l.valor)>0).sort((a,b)=>Number(a.numero)-Number(b.numero));
 const active=lots.find(l=>Number(l.numero)===Number(d.loteAtual));
 const linked=!!portal.id_desafio_lista&&String(challenge.id||'')===String(portal.id_desafio_lista)&&String(challenge.modalidade||'').trim().toUpperCase()===String(portal.modalidade||'').trim().toUpperCase();
 const rawVagas=d.vagasDisponiveis??d.vagas_disponiveis??(d.vagas&&d.vagas.disponiveis);
 const vagasValidas=rawVagas!==undefined&&rawVagas!==null&&rawVagas!==''&&
  Number.isInteger(Number(rawVagas))&&Number(rawVagas)>=0;
 const vagas=vagasValidas?Number(rawVagas):null;
 // O endpoint instalado pode estar desatualizado. Status ABERTO sozinho
 // nao comprova estoque; sem numero oficial de vagas, o botao segue ao Portal.
 const soldOut=status==='ESGOTADO'||vagas===0;
 const open=status==='ABERTO'&&linked&&!!active&&vagas!==null&&vagas>0;
 const container=$('.pricing-lots');
 if(container){
  const cards=lots.map(l=>{
   const card=element('div');card.dataset.lote=String(l.numero);
   if(open&&Number(l.numero)===Number(d.loteAtual))card.classList.add('is-current');
   card.append(element('span','',String(l.numero)+'º lote'),element('strong','',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(l.valor))),element('small','',l.inicio&&l.fim?'De '+date(l.inicio)+' a '+date(l.fim):'Datas informadas no Portal Giro'));
   return card;
  });
  if(!cards.length){const placeholder=element('div','lot-placeholder');placeholder.append(element('strong','','Consulte os valores no Portal Giro'));cards.push(placeholder);}
  container.replaceChildren(...cards);
 }
 const statuses={
  NAO_CADASTRADO:'Este desafio ainda não está disponível para inscrições.',
  EM_BREVE:'Inscrições previstas a partir de '+date(challenge.inicio)+'.',
  ENCERRADO:'Inscrições encerradas.',
  PAUSADO:'Inscrições temporariamente suspensas.',
  ESGOTADO:'Vagas esgotadas.',
  INDISPONIVEL:'Não foi possível confirmar a disponibilidade. Consulte o Portal Giro.'
 };
 state.textContent=open?'Inscrições abertas · '+active.numero+'º lote'+(active.fim?' · até '+date(active.fim):'')+'.':soldOut?'Vagas esgotadas.':statuses[status]||'Consulte a disponibilidade das inscrições no Portal Giro.';
 const link=portalUrl(d.url_inscricao||d.urlInscricao||d.link_inscricao||portal.url_inscricao,portal.id_desafio_lista);
 document.querySelectorAll('[data-cta]').forEach(a=>{
  a.href=open?link:portalUrl();
  a.setAttribute('aria-disabled','false');
  a.textContent=open?(a.dataset.label||'Quero me inscrever'):'Consultar inscrições no Portal Giro';
 });
}
function request(){return new Promise((resolve,reject)=>{
const name='dgmbLanding_'+Date.now()+'_'+(++seq),script=document.createElement('script'),url=new URL(endpoint);let timeout,done=false;
function cleanup(){clearTimeout(timeout);delete window[name];script.remove();}
function finish(error,payload){if(done)return;done=true;cleanup();if(error)reject(error);else resolve(payload);}
window[name]=data=>finish(null,data);
script.onerror=()=>finish(Error('API_INDISPONIVEL'));
timeout=setTimeout(()=>finish(Error('API_TIMEOUT')),8000);
url.searchParams.set('api','landing-campanha-v1');url.searchParams.set('campanha',slug);url.searchParams.set('callback',name);
script.src=url.href;document.head.append(script);
});}
async function refresh(){
clearTimeout(timer);
// Evita consumir chamadas ao Apps Script quando a aba nao esta visivel.
if(document.hidden){timer=setTimeout(refresh,60000);return;}
// Evita duas consultas simultaneas durante eventos rapidos de foco.
if(inFlight)return;
inFlight=true;
try{
 const data=await request();
 if(data&&data.status==='NAO_PUBLICADO'){
   document.body.setAttribute('data-campaign-loading','');
   load.hidden=false;load.textContent='Esta página ainda não está disponível. Acesse o Portal Giro para consultar os desafios.';
 }else{
   if(!data||data.status!=='OK'||!data.campanha||data.campanha.id!==slug)throw Error('CAMPANHA_INDISPONIVEL');
   const campaign=window.dgmbNormalizarCampanha(data.campanha);
   if(campaign.id!==slug)throw Error('CAMPANHA_ID_DIVERGENTE');
   const next=JSON.stringify(campaign);
   if(next!==revision){apply(campaign);revision=next;}
   commercial(data.inscricoes||{status:'INDISPONIVEL'});
   document.body.removeAttribute('data-campaign-loading');
   load.hidden=true;
 }
}catch(error){
 // Selim e 50tão possuem HTML editorial já publicado. Nunca esconder conteúdo por falha temporária da API.
 if(config||slug==='selim'||slug==='50tao'){
   document.body.removeAttribute('data-campaign-loading');
   load.hidden=true;
   commercial({status:'INDISPONIVEL'});
 }else{
   load.textContent='Esta página ainda não está disponível. Acesse o Portal Giro para consultar os desafios.';
   document.body.setAttribute('data-campaign-loading','');
   load.hidden=false;
 }
}
inFlight=false;
timer=setTimeout(refresh,60000);
}
if(!slug||!/^[a-z0-9][a-z0-9-]{1,69}$/.test(slug)){load.textContent='Página não encontrada.';return;}refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
})();
