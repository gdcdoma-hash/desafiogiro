'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = (source.match(/<script>([\s\S]*?)<\/script>/i) || [])[1];
assert.ok(script, 'Redirect oficial deve estar no HTML de entrada');

function destinoAoAbrir(hostname, search, hash='') {
  let handler, destination, timeoutCalled=0;
  const window = {
    location: {
      hostname, search, hash,
      replace(next) { destination=next; }
    },
    addEventListener(event, fn) {
      if(event==='DOMContentLoaded') handler=fn;
    }
  };
  const setTimeout = (fn, delay) => {
    assert.equal(delay, 900, 'Manter comportamento atual do carregamento');
    timeoutCalled++;
    fn();
  };
  vm.runInNewContext(script, { window, setTimeout });
  assert.equal(typeof handler, 'function');
  handler();
  return { destination, timeoutCalled };
}
test('Entrada oficial preserva REF do link até a URL do Portal Apps Script',()=>{
  for (const query of ['?ref=1145','?ref=LAB_TRANSMISSAO','?ref=LAB_CORACAO',
    '?ref=1145&utm_campaign=convite','']) {
    const result=destinoAoAbrir('desafiogiro.gmbd.com.br',query);
    assert.match(result.destination, /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/);
    assert.ok(result.destination.endsWith('/exec'+query),
      'O redirect não pode perder nem substituir a REF: '+query);
    assert.equal(result.timeoutCalled,1);
  }
});
test('Domínio antigo apresenta aviso e preserva a query sem abrir o Portal',()=>{
  const result=destinoAoAbrir('desafiogiro.giromotosbikes.com.br','?ref=LAB_CORACAO','#ajuda');
  assert.equal(result.destination,'/mudanca-de-endereco.html?ref=LAB_CORACAO#ajuda');
  assert.equal(result.timeoutCalled,0);
});
