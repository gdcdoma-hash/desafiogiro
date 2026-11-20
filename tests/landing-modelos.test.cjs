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
