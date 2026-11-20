'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const normalizar = require('../landing/modelos.js');

const code = fs.readFileSync(path.join(__dirname, '..', 'bridge', 'LandingPublicApi.gs'), 'utf8');
const CAMPANHA = {
  id: 'selim', nome: 'Pedalada Selim', modalidade: 'Pedalada',
  portal: {id_desafio_lista: '166', modalidade: 'CICLISMO', endpoint: 'https://admin.invalid/secret'},
  imagens: {principal: 'medalha-selim.webp'},
  texto: {hero_titulo: 'Campanha aprovada'},
  url_portal_giro: 'https://admin.invalid/',
  cpf: 'DEVE_SER_REMOVIDO', chave_pix: 'NAO_PUBLICAR'
};

const H_DESAFIOS = [
  'id_Desafio_lista','id_desafio_base','Nome_Desafio','Status','Tipo',
  'Periodo','Data_Inicio','Data_Fim','Permite_Inscricao','Tipo_Meta',
  'Prazos_Dias','Modalidade_Esportiva'
];
const H_PIX = [
  'id_lote','nome_lote','data_inicio_sistema','data_fim_sistema',
  'data_inicio_cliente','data_fim_cliente','valor_unitario','chave_pix',
  'validade_pix','status','observacao','modo_pix','qtd_inscricoes',
  'tipo_inscricao','valor_total'
];

function tab(rows) {
  return {
    getLastRow: () => rows.length,
    getRange(_r, _c, count, columns) {
      return {getDisplayValues: () => rows.slice(0, count).map(r =>
        Array.from({length: columns}, (_, i) => String(r[i] ?? ''))) };
    }
  };
}

function fixture(opts={}) {
  const published = opts.publicado === undefined ? JSON.stringify({...CAMPANHA, ...(opts.campanha||{})}) : opts.publicado;
  const rows = {
    LandingCampanhas: [
      ['slug','rascunho_json','publicado_json','versao','atualizado_em'],
      ['selim', JSON.stringify({...CAMPANHA, cpf: 'DADO_RASCUNHO'}), published, '9', '20/11/2026']
    ],
    ListaDesafios: [
      H_DESAFIOS,
      ['166','DG_MEDALHA_SELIM','MEDALHA SELIM',opts.statusDesafio||'Ativo','Normal','novembro/2026',
        opts.inicio||'2026-10-20',opts.fim||'2026-11-30',opts.permite||'Sim','KM','','CICLISMO']
    ],
    PixLotes: [
      H_PIX,
      ['NOV26_L2_Q1','Lote 2 - 1 inscrição','16/11/2026','30/11/2026',
        '16/11/2026','30/11/2026','44,9','SEGREDO_PIX','','Ativo','','POR_QTD','1','TODOS','44,9']
    ]
  };
  if (opts.outraCampanha) rows.LandingCampanhas.push(['nova','{}',null,'1','20/11/2026']);
  if (opts.multiplosLotes) rows.PixLotes.push([...rows.PixLotes[1].slice(0, 2), ...rows.PixLotes[1].slice(2)]);
  if (opts.modalidadeDesafio) rows.ListaDesafios[1][11] = opts.modalidadeDesafio;
  const sheets = Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, tab(v)]));
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({getSheetByName: name => sheets[name] || null}),
      openById: () => {throw Error('nao usar planilha diferente');}
    },
    PropertiesService: {getScriptProperties: () => ({getProperty: () => ''})},
    Utilities: {formatDate: () => opts.hoje || '2026-11-20'},
    Session: {getScriptTimeZone: () => 'America/Fortaleza'},
    ContentService: {
      MimeType: {JSON: 'application/json', JAVASCRIPT: 'application/javascript'},
      createTextOutput: value => ({
        value, mimeType: null,
        setMimeType(mime) {this.mimeType = mime; return this;}
      })
    },
    ...(opts.fonte ? {dgmbLandingConsultaDisponibilidadeOficial_: opts.fonte} : {})
  };
  vm.runInNewContext(code, context);
  return context;
}

test('le somente o JSON publicado e impede exposicao de CPF, PIX e endpoint administrativo', () => {
  const ctx = fixture();
  const r = ctx.dgmbLandingPublicPayload_('selim');
  assert.equal(r.status, 'OK');
  assert.equal(r.campanha.id, 'selim');
  assert.equal(r.campanha.texto.hero_titulo, 'Campanha aprovada');
  assert.equal(r.campanha.portal.id_desafio_lista, '166');
  assert.equal(r.campanha.portal.endpoint, undefined);
  for(const forbidden of ['cpf','chave_pix','url_portal_giro','SEGREDO_PIX','DADO_RASCUNHO']) {
    assert(!JSON.stringify(r).includes(forbidden), forbidden);
  }
  assert.equal(r.inscricoes.status, 'INDISPONIVEL');
  assert.equal(r.inscricoes.loteAtual, 2);
  assert.equal(r.inscricoes.lotes[0].valor, 44.9);
  assert.equal(normalizar(r.campanha).imagens.principal, 'medalha-selim.webp');
});

test('sem publicado, slug valido desconhecido ou JSON invalido nao publicam medalha', () => {
  assert.equal(fixture({publicado: ''}).dgmbLandingPublicPayload_('selim').status, 'NAO_PUBLICADO');
  assert.equal(fixture().dgmbLandingPublicPayload_('nao-existe').status, 'NAO_PUBLICADO');
  assert.equal(fixture().dgmbLandingPublicPayload_('../segredo').status, 'NAO_PUBLICADO');
  assert.equal(fixture({publicado: '{invalido'}).dgmbLandingPublicPayload_('selim').status, 'INDISPONIVEL');
});

test('divergencia no ID ou modalidade nao anuncia a campanha', () => {
  assert.equal(fixture({campanha:{portal:{id_desafio_lista:'999',modalidade:'CICLISMO'}}}).dgmbLandingPublicPayload_('selim').status, 'INDISPONIVEL');
  assert.equal(fixture({modalidadeDesafio:'CAMINHADA_CORRIDA'}).dgmbLandingPublicPayload_('selim').status, 'INDISPONIVEL');
});

test('ABERTO exige resposta oficial com vagas, lote unico e desafio valido', () => {
  const fonte = () => ({status:'ABERTO', vagasDisponiveis:12});
  const ok = fixture({fonte}).dgmbLandingPublicPayload_('selim');
  assert.equal(ok.inscricoes.status, 'ABERTO');
  assert.equal(ok.inscricoes.vagasDisponiveis, 12);
  assert(!('url_inscricao' in ok.inscricoes));
  assert.equal(fixture({fonte:()=>({status:'ABERTO'})}).dgmbLandingPublicPayload_('selim').inscricoes.status, 'INDISPONIVEL');
  assert.equal(fixture({fonte,multiplosLotes:true}).dgmbLandingPublicPayload_('selim').inscricoes.status, 'INDISPONIVEL');
  assert.equal(fixture({fonte,permite:'Não'}).dgmbLandingPublicPayload_('selim').inscricoes.status, 'PAUSADO');
  assert.equal(fixture({fonte,hoje:'2026-12-01'}).dgmbLandingPublicPayload_('selim').inscricoes.status, 'ENCERRADO');
  assert.equal(fixture({fonte,hoje:'2026-10-01'}).dgmbLandingPublicPayload_('selim').inscricoes.status, 'EM_BREVE');
});

test('zero vagas significa esgotado e nao ABERTO', () => {
  const r = fixture({fonte:()=>({status:'ABERTO', vagasDisponiveis:0})}).dgmbLandingPublicPayload_('selim');
  assert.equal(r.inscricoes.status, 'ESGOTADO');
  assert.equal(r.inscricoes.vagasDisponiveis, 0);
});

test('jsonp valida callback e nunca devolve API interna para callback arbitrario', () => {
  const ctx = fixture();
  const bad = ctx.dgmbLandingPublicApi_({parameter:{callback:'alert(1)',campanha:'selim'}});
  assert.equal(bad.value, '/* callback invalido */');
  const good = ctx.dgmbLandingPublicApi_({parameter:{callback:'dgmbLanding_1795180000000_1',campanha:'selim'}});
  assert.match(good.value, /^dgmbLanding_1795180000000_1\(/);
  assert.equal(good.mimeType, 'application/javascript');
  assert(!good.value.includes('SEGREDO_PIX'));
  assert(!good.value.includes('DEVE_SER_REMOVIDO'));
});
