/** Diagnóstico somente-leitura da API pública de campanha.
 * Não exibe dados da API, apenas resultado da acessibilidade e status resumido.
 * Um erro da rede não altera a produção nem autoriza publicar uma campanha.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('landing/campanha.js'), 'utf8');
const match = source.match(/const endpoint=['"]([^'"]+)['"]/);
if (!match) throw Error('Endpoint de campanha não encontrado no motor da landing.');
const base = match[1];

for (const [i, slug] of ['selim', '50tao'].entries()) {
  const cb = 'dgmbLanding_' + Date.now() + '_' + (i + 1);
  const url = new URL(base);
  url.searchParams.set('api', 'landing-campanha-v1');
  url.searchParams.set('campanha', slug);
  url.searchParams.set('callback', cb);
  let verdict = 'NAO_HOMOLOGADO', detail = 'INDETERMINADO';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/javascript,text/javascript,*/*' } });
    if (!res.ok) {
      detail = 'HTTP_' + res.status;
    } else {
      const body = await res.text();
      const prefix = cb + '(';
      const tail = body.match(/\)\s*;?\s*$/);
      if (!body.startsWith(prefix) || !tail) {
        detail = 'RESPOSTA_NAO_JSONP';
      } else {
        const raw = body.slice(prefix.length, tail.index);
        const payload = JSON.parse(raw);
        const state = String(payload?.status || '').toUpperCase();
        const validStates = ['OK','NAO_PUBLICADO','INDISPONIVEL','NAO_CADASTRADO'];
        if (validStates.includes(state)) {
          verdict = state === 'OK' ? 'RESPONDE' : 'RESPONDE_SEM_PUBLICACAO';
          detail = state;
        } else detail = 'ESTADO_DESCONHECIDO';
      }
    }
  } catch(e) {
    detail = e?.name === 'TimeoutError' ? 'TIMEOUT' : 'ERRO_DE_REDE_OU_FORMATO';
  }
  console.log('API_PUBLICA ' + slug + ': ' + verdict + ' (' + detail + ')');
  if (verdict !== 'RESPONDE') console.log('ATENCAO ' + slug + ': homologacao completa ainda pendente.');
}
