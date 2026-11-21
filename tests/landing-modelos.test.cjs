'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const build=require('../landing/modelos.js');

const make=(overrides={})=>({id:'desafio-teste',nome:'Medalha Nova',portal:{id_desafio_lista:'188',modalidade:'CICLISMO'},imagens:{principal:'medalha-nova.webp'},...overrides});

test('gerador cria textos completos para ciclismo sem edição manual',()=>{
 const data=build(make({meta_km:120,periodo:'dezembro/2026'}));
 assert.equal(data.id,'desafio-teste');
 assert.equal(data.portal.id_desafio_lista,'188');
 assert.equal(data.modalidade,'Ciclismo');
 assert.match(data.texto.hero_descricao,/120 km/);
 assert.match(data.texto.hero_descricao,/dezembro\/2026/);
 assert.match(data.texto.intro_texto,/pedaladas/i);
 assert.equal(data.galeria[0].arquivo,'medalha-nova.webp');
 assert.equal(data.imagens.compartilhamento,'medalha-nova.webp');
 assert.equal(data.perguntas.length,5);
 assert.equal(data.passos.length,4);
});
test('caminhada e corrida usa texto específico, sem vocabulário de pedalada',()=>{
 const data=build(make({modalidade:'Caminhada/Corrida',portal:{id_desafio_lista:'189',modalidade:'CAMINHADA_CORRIDA'},meta_fixa_km:50}));
 const editorial=JSON.stringify(data.texto)+JSON.stringify(data.passos);
 assert.match(editorial,/Caminhe ou corra/);
 assert.match(editorial,/50 km/);
 assert.doesNotMatch(editorial,/pedale|pedaladas|ciclismo/i);
});
test('meta e período ausentes não geram números ou datas imaginárias',()=>{
 const data=build(make());
 assert.match(data.texto.hero_descricao,/Escolha uma meta disponível/);
 assert.doesNotMatch(JSON.stringify(data),/R\$ 39,90|R\$ 44,90|novembro de 2026/);
});
test('modelo respeita textos, cores, fotos e FAQs já publicados pelo Admin',()=>{
 const original=make({texto:{hero_titulo:'Minha campanha',hero_descricao:'Texto aprovado'},cores:{destaque:'#123456'},imagens:{principal:'minha.webp',detalhe:'minha-outra.webp'},perguntas:[{pergunta:'Especial?',resposta:'Sim.'}],botoes:{principal:'Participar já'}});
 const data=build(original);
 assert.equal(data.texto.hero_titulo,'Minha campanha');
 assert.equal(data.texto.hero_descricao,'Texto aprovado');
 assert.equal(data.cores.destaque,'#123456');
 assert.equal(data.imagens.detalhe,'minha-outra.webp');
 assert.equal(data.perguntas[0].pergunta,'Especial?');
 assert.equal(data.botoes.principal,'Participar já');
});
test('imagem oficial é obrigatória: nunca reutilizar foto de outra medalha',()=>{
 assert.throws(()=>build({...make(),imagens:{}}),/IMAGEM_OFICIAL_AUSENTE/);
});
test('vínculo de desafio e modalidade são obrigatórios para publicar',()=>{
 assert.throws(()=>build(make({portal:{modalidade:'CICLISMO'}})),/DESAFIO_SEM_VINCULO/);
 assert.throws(()=>build(make({portal:{id_desafio_lista:'188',modalidade:'NATACAO'}})),/MODALIDADE_INVALIDA/);
 assert.throws(()=>build(make({id:'../segredo'})),/IDENTIFICACAO_INVALIDA/);
});

test('roteamento mantém as duas medalhas anteriores e usa modelo neutro nas novas',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..');
 const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
 const routes=Object.fromEntries(config.rewrites.map(r=>[r.source,r.destination]));
 assert.equal(routes['/desafios/selim/'],'/landing/index.html');
 assert.equal(routes['/desafios/50tao/'],'/landing/50tao.html');
 assert.equal(routes['/desafios/:campanha/'],'/landing/modelo.html?campanha=:campanha');
 const html=fs.readFileSync(path.join(root,'landing/modelo.html'),'utf8');
 assert.match(html,/modelos\.js\?v=20261121-etapas1/);
 assert.match(html,/id="campaign-load"/);
 assert.match(html,/id="inscricao-status"/);
 assert.doesNotMatch(html,/Selim|50tão|medalha-selim\.webp|50km-medalha\.webp/i);
});

test('modo automático não copia textos, FAQ, cenas ou imagens secundárias antigas',()=>{
 const data=build(make({
   modo_conteudo:'AUTOMATICO',
   imagem_medalha:'nova-medalha.webp',
   texto:{hero_titulo:'Pedalada Selim antiga',hero_descricao:'novembro de 2026'},
   perguntas:[{pergunta:'Qual o valor R$ 39,90?',resposta:'Antigo'}],
   passos:[{icone:'1',titulo:'Pedale',descricao:'Pedalada antiga'}],
   galeria:[{arquivo:'medalha-selim.webp',legenda:'Antigo',alt:'Antigo'}],
   imagens:{principal:'medalha-selim.webp',detalhe:'medalha-selim.webp',cenario:'cenario-pedalada.webp',compartilhamento:'medalha-selim.webp'}
 }));
 assert.equal(data.imagens.principal,'nova-medalha.webp');
 assert.equal(data.imagens.detalhe,'nova-medalha.webp');
 assert.equal(data.imagens.compartilhamento,'nova-medalha.webp');
 assert.equal(data.imagens.cenario,'');
 assert.equal(data.galeria.length,1);
 assert.equal(data.galeria[0].arquivo,'nova-medalha.webp');
 assert.equal(data.texto.hero_titulo,'Medalha Nova.');
 assert.doesNotMatch(JSON.stringify({texto:data.texto,passos:data.passos,perguntas:data.perguntas,galeria:data.galeria}),/Pedalada Selim antiga|novembro de 2026|R\$ 39,90|medalha-selim/i);
});
test('modo automático aceita somente personalização intencional',()=>{
 const data=build(make({geracao_automatica:true,texto:{hero_titulo:'Título antigo'},texto_personalizado:{hero_titulo:'Título aprovado'},botoes:{principal:'Botão antigo'},botoes_personalizados:{principal:'Quero participar'}}));
 assert.equal(data.texto.hero_titulo,'Título aprovado');
 assert.equal(data.botoes.principal,'Quero participar');
});
test('redação automática não usa artigo incorreto com Medalha',()=>{
 const data=build(make({meta_km:75}));
 assert.doesNotMatch(data.texto.hero_descricao,/Participe do Medalha/);
 assert.match(data.texto.hero_descricao,/Conheça Medalha Nova/);
});

test('conquista de uma etapa funciona sem atrelar a um nome especifico',()=>{
 const data=build(make({etapas:[{titulo:'Uma etapa',descricao:'Uma conquista',imagem:'',imagem_alt:''}]}));
 assert.equal(data.etapas.length,1);
 assert.equal(data.etapas[0].titulo,'Uma etapa');
});
test('duas etapas independentes funcionam em qualquer modalidade',()=>{
 const data=build(make({
  modalidade:'Caminhada/Corrida',
  portal:{id_desafio_lista:'189',modalidade:'CAMINHADA_CORRIDA'},
  etapas:[
   {titulo:'Etapa inicial',descricao:'Primeira conquista',imagem:'https://example.org/um.webp',imagem_alt:'Primeira etapa'},
   {titulo:'Etapa seguinte',descricao:'Segunda conquista',imagem:'',imagem_alt:''}
  ]
 }));
 assert.equal(data.etapas.length,2);
 assert.equal(data.etapas[0].imagem_alt,'Primeira etapa');
 assert.equal(data.etapas[1].imagem_alt,'Etapa seguinte');
});
test('campanha antiga sem etapas permanece sem secao extra',()=>{
 const data=build(make());
 assert.deepEqual(data.etapas,[]);
});
test('dados malformados nao criam etapa vazia',()=>{
 const data=build(make({etapas:[null,{}, {titulo:'Sem descricao'}, {titulo:'Valida',descricao:'Conquista valida'}]}));
 assert.equal(data.etapas.length,1);
 assert.equal(data.etapas[0].titulo,'Valida');
});
