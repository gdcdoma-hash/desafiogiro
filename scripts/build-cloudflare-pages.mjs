/**
 * Desafio Giro: pacote estático para Cloudflare Pages.
 * Não publica, não conecta contas nem modifica o Portal Apps Script.
 * Comando: node scripts/build-cloudflare-pages.mjs
 * Saída: dist-cloudflare-pages/
 */
import { cp, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist-cloudflare-pages');

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'landing'), { recursive: true });

for (const name of [
  'index.html',
  'mudanca-de-endereco.html',
  'logo-desafio-giro.png',
  'flyer-outubro-rosa-home.jpg',
]) {
  await copyFile(join(root, name), join(output, name));
}

for (const name of [
  '50tao.html',
  'index.html',
  'modelo.html',
  'styles.css',
  'script.js',
  'modelos.js',
  'campanha.js',
]) {
  await copyFile(join(root, 'landing', name), join(output, 'landing', name));
}
await cp(join(root, 'landing', 'assets'), join(output, 'landing', 'assets'), {
  recursive: true,
});

// Rotas específicas ANTES da regra dinâmica; URL pública preservada no navegador.
// A página dinâmica extrai o slug de location.pathname.
await writeFile(join(output, '_redirects'), [
  '# Desafio Giro — regras de proxy interno (sem Worker/Pages Function)',
  '/desafios/50tao /landing/50tao.html 200',
  '/desafios/50tao/ /landing/50tao.html 200',
  '/desafios/selim /landing/index.html 200',
  '/desafios/selim/ /landing/index.html 200',
  '/desafios/:campanha /landing/modelo.html 200',
  '/desafios/:campanha/ /landing/modelo.html 200',
  '',
].join('\n'), 'utf8');

await writeFile(join(output, '_headers'), [
  '/landing/*',
  '  Cache-Control: public, max-age=0, must-revalidate',
  '  X-Content-Type-Options: nosniff',
  '',
].join('\n'), 'utf8');

console.log('Pacote estático Cloudflare Pages gerado em dist-cloudflare-pages/.');
