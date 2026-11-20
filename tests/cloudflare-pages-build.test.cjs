const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const out = join(root, 'dist-cloudflare-pages');

test('pacote Cloudflare é gerado sem usar tokens nem publicar', () => {
  execFileSync(process.execPath, [join(root, 'scripts/build-cloudflare-pages.mjs')], {
    cwd: root,
    stdio: 'pipe',
  });
  for (const relative of [
    'index.html',
    'mudanca-de-endereco.html',
    'logo-desafio-giro.png',
    'landing/index.html',
    'landing/50tao.html',
    'landing/modelo.html',
    'landing/styles.css',
    'landing/script.js',
    'landing/campanha.js',
    'landing/modelos.js',
    'landing/assets/medalha-selim.webp',
    '_redirects',
    '_headers',
  ]) {
    assert.ok(existsSync(join(out, relative)), `Arquivo necessário não copiado: ${relative}`);
  }
  for (const sensitive of ['.github', 'tests', 'scripts', 'vercel.json', 'LANDING_PORTAL_V2.md']) {
    assert.equal(existsSync(join(out, sensitive)), false, `Arquivo interno exposto: ${sensitive}`);
  }
});

test('roteamento preserva campanhas específicas e modelo dinâmico', () => {
  const lines = readFileSync(join(out, '_redirects'), 'utf8')
    .split(/\r?\n/)
    .filter(s => s && !s.startsWith('#'));
  assert.deepEqual(lines, [
    '/desafios/50tao /landing/50tao.html 200',
    '/desafios/50tao/ /landing/50tao.html 200',
    '/desafios/selim /landing/index.html 200',
    '/desafios/selim/ /landing/index.html 200',
    '/desafios/:campanha /landing/modelo.html 200',
    '/desafios/:campanha/ /landing/modelo.html 200',
  ]);
  const script = readFileSync(join(out, 'landing/campanha.js'), 'utf8');
  assert.match(script, /location\.pathname/);
  assert.match(script, /landing-campanha-v1/);
  assert.match(script, /api=|searchParams\.set\('api'/);
});

test('o pacote mantém URLs principais sem recursos de backend Cloudflare', () => {
  assert.equal(existsSync(join(out, '_worker.js')), false);
  assert.equal(existsSync(join(out, 'functions')), false);
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /script\.google\.com\/macros\/s\//);
  assert.ok(readdirSync(join(out, 'landing', 'assets')).length > 0);
});
