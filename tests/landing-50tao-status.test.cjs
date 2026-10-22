const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Exercita a rotina JSONP original, sem acessar inscrições reais.
const source = fs.readFileSync(path.join(__dirname, '..', 'landing', '50tao.js'), 'utf8');
const start = source.indexOf('function request(){');
const end = source.indexOf('async function refresh(){');
assert(start >= 0 && end > start, 'A rotina request deve existir');
const requestSource = source.slice(start, end);
const factory = new Function(
  'document', 'window', 'setTimeout', 'clearTimeout', 'frozenCampaign', 'slug',
  'let seq=0;' + requestSource + 'return request;'
);

async function consultar(payload, falha) {
  let script;
  const document = {
    createElement: () => ({ remove() {} }),
    head: { append(node) { script = node; } }
  };
  const window = {};
  const request = factory(document, window, () => 1, () => {}, { id: '50tao' }, '50tao');
  const pending = request();
  const callback = Object.keys(window)[0];
  assert(callback && script && script.src);
  if (falha) script.onerror();
  else window[callback](payload);
  return pending;
}

test('50tão preserva inscrições ABERTO da resposta oficial', async () => {
  const data = {
    status: 'OK',
    campanha: { id: '50tao', portal: { id_desafio_lista: '167' } },
    inscricoes: { status: 'ABERTO', desafio: { id: '167' }, loteAtual: 1, lotes: [{ numero: 1, valor: 39.9 }] }
  };
  const resultado = await consultar(data);
  assert.equal(resultado.inscricoes.status, 'ABERTO');
  assert.equal(resultado.inscricoes.desafio.id, '167');
});

test('falha de rede mantém conteúdo editorial mas não inventa inscrição aberta', async () => {
  const resultado = await consultar(null, true);
  assert.equal(resultado.campanha.id, '50tao');
  assert.equal(resultado.inscricoes.status, 'INDISPONIVEL');
});

test('resposta sem campanha válida não habilita inscrições', async () => {
  const resultado = await consultar({ status: 'NAO_PUBLICADO' });
  assert.equal(resultado.inscricoes.status, 'INDISPONIVEL');
});
