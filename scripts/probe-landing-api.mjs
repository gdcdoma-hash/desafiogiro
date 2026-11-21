/** Diagnóstico somente-leitura da API canônica de campanhas no Apps Script.
 * Nunca registra a resposta integral, dados pessoais ou segredos da API.
 * Não publica, não altera inscrições, não faz mutações de dados.
 * O retorno OK é apenas sinal de consulta: exige verificações adicionais.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('landing/campanha.js'), 'utf8');
const match = source.match(/const endpoint=['"]([^'"]+)['"]/);
if (!match) throw Error('Endpoint de campanha não encontrado no motor da landing.');
const endpoint = match[1];

const campaigns = [
  { slug: 'selim', modalidade: 'CICLISMO' },
  { slug: '50tao', modalidade: 'CAMINHADA_CORRIDA' },
];

const states = new Set(['OK', 'NAO_PUBLICADO', 'INDISPONIVEL', 'NAO_CADASTRADO']);
const commercialStates = new Set(['ABERTO', 'EM_BREVE', 'PAUSADO', 'ESGOTADO', 'ENCERRADO', 'INDISPONIVEL', 'NAO_CADASTRADO']);
let fullMatches = 0;

for (const [i, expected] of campaigns.entries()) {
  const cb = 'dgmbLanding_' + Date.now() + '_' + (i + 1);
  const url = new URL(endpoint);
  url.searchParams.set('api', 'landing-campanha-v1');
  url.searchParams.set('campanha', expected.slug);
  url.searchParams.set('callback', cb);
  let result = 'NAO_HOMOLOGADO';
  let detail = 'INDETERMINADO';
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/javascript,text/javascript,*/*' },
    });
    if (!res.ok) {
      detail = 'HTTP_' + res.status;
    } else {
      const rawText = await res.text();
      const prefix = cb + '(';
      const suffix = rawText.match(/\)\s*;?\s*$/);
      if (rawText.length > 250000 || !rawText.startsWith(prefix) || !suffix) {
        detail = 'FORMATO_JSONP_INESPERADO';
      } else {
        // JSON.parse, nunca eval: conteúdo remoto é tratado somente como dado.
        const response = JSON.parse(rawText.slice(prefix.length, suffix.index));
        const apiState = String(response?.status || '').toUpperCase();
        if (!states.has(apiState)) {
          detail = 'STATUS_API_DESCONHECIDO';
        } else if (apiState !== 'OK') {
          result = 'API_ACESSIVEL';
          detail = apiState;
        } else {
          const campaign = response.campanha || {};
          const portal = campaign.portal || {};
          const comm = response.inscricoes || {};
          const challenge = comm.desafio || {};
          const commState = String(comm.status || '').toUpperCase();
          const lotes = Array.isArray(comm.lotes) ? comm.lotes : [];
          const id = String(portal.id_desafio_lista || '');
          const mode = String(portal.modalidade || '').toUpperCase();
          const linked = Boolean(
            id && String(challenge.id || '') === id &&
            String(challenge.modalidade || '').toUpperCase() === mode
          );
          const priceLot = lotes.find(l =>
            Number(l?.numero) === Number(comm.loteAtual) &&
            Number.isFinite(Number(l?.valor)) && Number(l.valor) > 0
          );
          const saldoInformado = comm.vagasDisponiveis !== undefined &&
            comm.vagasDisponiveis !== null && comm.vagasDisponiveis !== '';
          const available = Number(comm.vagasDisponiveis);
          const validAvailability = saldoInformado && Number.isInteger(available) && available >= 0;
          const openValid = commState !== 'ABERTO' ||
            (linked && Boolean(priceLot) && validAvailability && available > 0);
          const publicData = JSON.stringify(response);
          const noSecrets = !/"(cpf|chave_pix|secret|token|telefone|whatsapp|email)"\s*:/i.test(publicData);
          const valid = campaign.id === expected.slug &&
            mode === expected.modalidade &&
            linked && commercialStates.has(commState) &&
            openValid && noSecrets;

          if (valid) {
            result = 'CONTRATO_VALIDADO';
            detail = commState;
            fullMatches++;
          } else {
            const reasons = [
              campaign.id === expected.slug ? '' : 'CAMPANHA_DIVERGENTE',
              mode === expected.modalidade ? '' : 'MODALIDADE_DIVERGENTE',
              linked ? '' : 'VINCULO_NAO_CONFIRMADO',
              commercialStates.has(commState) ? '' : 'STATUS_INSCRICAO_INVALIDO',
              commState !== 'ABERTO' || Boolean(priceLot) ? '' : 'ABERTO_SEM_LOTE_ATIVO',
              commState !== 'ABERTO' || validAvailability ? '' : 'ABERTO_SEM_SALDO_CONFIRMADO',
              commState !== 'ABERTO' || (validAvailability && available > 0) ? '' : 'ABERTO_SEM_SALDO_POSITIVO',
              openValid ? '' : 'ABERTURA_SEM_GARANTIAS',
              noSecrets ? '' : 'CAMPO_SENSIVEL_NO_PUBLICO',
            ].filter(Boolean);
            detail = reasons.join(',') || 'DADOS_INCOMPLETOS';
            result = 'REPROVADO';
          }
        }
      }
    }
  } catch (error) {
    detail = error?.name === 'TimeoutError' ? 'TIMEOUT' : 'FALHA_REDE_OU_FORMATO';
  }
  console.log('API_PUBLICA ' + expected.slug + ': ' + result + ' (' + detail + ')');
}
console.log('RESUMO_API_CANONICA: ' + fullMatches + '/' + campaigns.length + ' contratos comerciais validados.');
// Diagnóstico propositalmente não bloqueante: a indisponibilidade da API não
// transforma um PR de hospedagem estática em autorização para publicar vendas.
