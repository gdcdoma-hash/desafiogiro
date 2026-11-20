/**
 * Ponte de leitura pública para Landing Pages 2.0 do Desafio Giro.
 * Adicionar este arquivo ao Apps Script do ADMIN (nao a Vercel).
 * Nao cria nem altera cadastros, pagamentos, fotos ou inscricoes.
 *
 * No doGet(e) ja existente, inserir ANTES da renderizacao HTML:
 * if (e && e.parameter && e.parameter.api === 'landing-campanha-v1') {
 *   return dgmbLandingPublicApi_(e);
 * }
 *
 * Expor ABERTO somente ao conectar a funcao oficial:
 * dgmbLandingConsultaDisponibilidadeOficial_(idDesafio, modalidade)
 * que deve retornar {status, vagasDisponiveis, [url_inscricao]}.
 */
function dgmbLandingPublicApi_(e) {
  var p = e && e.parameter ? e.parameter : {};
  var cb = String(p.callback || '');
  if (cb && !/^dgmbLanding_[0-9]{8,20}_[0-9]{1,6}$/.test(cb)) {
    return ContentService.createTextOutput('/* callback invalido */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  var result;
  try {
    result = dgmbLandingPublicPayload_(String(p.campanha || ''));
  } catch (error) {
    // Nao incluir detalhes internos do Apps Script na resposta publica.
    result = {status: 'INDISPONIVEL'};
  }
  var body = JSON.stringify(result).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return ContentService.createTextOutput(cb ? cb + '(' + body + ');' : body)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function dgmbLandingPublicPayload_(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,69}$/.test(slug)) {
    return {status: 'NAO_PUBLICADO'};
  }
  var ss = dgmbLandingPlanilha_();
  var tab = ss.getSheetByName('LandingCampanhas');
  if (!tab) return {status: 'INDISPONIVEL'};
  var rows = dgmbLandingLinhas_(tab, 3), raw = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === slug) {
      raw = String(rows[i][2] || '').trim();
      break;
    }
  }
  if (!raw) return {status: 'NAO_PUBLICADO'};
  var campanha;
  try { campanha = JSON.parse(raw); } catch (error) { return {status: 'INDISPONIVEL'}; }
  if (!campanha || campanha.id !== slug || !campanha.portal) {
    return {status: 'INDISPONIVEL'};
  }
  var id = String(campanha.portal.id_desafio_lista || '').trim();
  var modalidade = String(campanha.portal.modalidade || '').toUpperCase().trim();
  if (!id || !/^(CICLISMO|CAMINHADA_CORRIDA)$/.test(modalidade)) {
    return {status: 'INDISPONIVEL'};
  }
  var desafio = dgmbLandingDesafioOficial_(ss, id);
  if (!desafio || String(desafio.modalidade).toUpperCase() !== modalidade) {
    return {status: 'INDISPONIVEL'};
  }
  var publico = dgmbLandingPublicarCampos_(campanha, id, modalidade);
  var inscricoes = dgmbLandingSituacaoOficial_(ss, desafio);
  return {status: 'OK', campanha: publico, inscricoes: inscricoes};
}

function dgmbLandingPlanilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty('DGMB_SPREADSHEET_ID') || '').trim();
  var sheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) throw new Error('PLANILHA_NAO_CONFIGURADA');
  return sheet;
}

function dgmbLandingLinhas_(sheet, columns) {
  var last = sheet.getLastRow();
  return last > 0 ? sheet.getRange(1, 1, last, columns).getDisplayValues() : [];
}

function dgmbLandingDesafioOficial_(ss, id) {
  var tab = ss.getSheetByName('ListaDesafios');
  if (!tab) return null;
  var rows = dgmbLandingLinhas_(tab, 12);
  var expected = [
    'id_Desafio_lista', 'id_desafio_base', 'Nome_Desafio', 'Status',
    'Tipo', 'Periodo', 'Data_Inicio', 'Data_Fim',
    'Permite_Inscricao', 'Tipo_Meta', 'Prazos_Dias', 'Modalidade_Esportiva'
  ];
  if (!rows.length || expected.some(function(h, i) {
    return String(rows[0][i] || '').trim() !== h;
  })) return null;
  var matches = rows.slice(1).filter(function(r) { return String(r[0] || '').trim() === id; });
  if (matches.length !== 1) return null;
  var r = matches[0];
  return {
    id: id, nome: r[2], status: r[3], tipo: r[4],
    inicio: dgmbLandingDataISO_(r[6]), fim: dgmbLandingDataISO_(r[7]),
    permite: String(r[8] || '').trim().toUpperCase() === 'SIM',
    modalidade: String(r[11] || '').trim().toUpperCase()
  };
}

function dgmbLandingPublicarCampos_(raw, id, modalidade) {
  // Lista fechada: nunca exportar endpoints administrativos, CPF, PIX ou tokens.
  var allowed = [
    'id', 'nome', 'modalidade', 'geracao_automatica', 'modo_conteudo',
    'meta_km', 'meta_fixa_km', 'distancia_km', 'periodo', 'periodo_desafio',
    'frase_marca', 'seo_descricao', 'cores', 'imagens', 'imagem_medalha',
    'url_imagem_medalha', 'imagem_detalhe_medalha', 'imagem_cenario',
    'imagem_compartilhamento', 'texto', 'texto_personalizado', 'botoes',
    'botoes_personalizados', 'destaques', 'destaques_personalizados',
    'passos', 'passos_personalizados', 'caracteristicas_medalha',
    'caracteristicas_personalizadas', 'galeria', 'galeria_personalizada',
    'perguntas', 'perguntas_personalizadas'
  ];
  var out = {};
  allowed.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) out[key] = raw[key];
  });
  out.portal = {id_desafio_lista: id, modalidade: modalidade};
  return out;
}

function dgmbLandingHoje_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Fortaleza', 'yyyy-MM-dd');
}

function dgmbLandingDataISO_(date) {
  var v = String(date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    var p = v.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
  }
  return '';
}

function dgmbLandingValor_(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  var str = String(value || '').trim().replace(/^R\$\s*/, '');
  if (!/^[\d.,]+$/.test(str)) return null;
  var n = Number(str.includes(',') ? str.replace(/\./g, '').replace(',', '.') : str);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function dgmbLandingLoteAtual_(ss, today) {
  var tab = ss.getSheetByName('PixLotes');
  if (!tab) return null;
  var rows = dgmbLandingLinhas_(tab, 15);
  var h = rows[0] || [];
  var keys = ['nome_lote', 'data_inicio_sistema', 'data_fim_sistema', 'valor_unitario',
    'status', 'qtd_inscricoes', 'tipo_inscricao'];
  var positions = keys.map(function(k) { return h.indexOf(k); });
  if (positions.some(function(index) { return index < 0; })) return null;
  var candidates = rows.slice(1).filter(function(r) {
    var start = dgmbLandingDataISO_(r[positions[1]]);
    var end = dgmbLandingDataISO_(r[positions[2]]);
    return start && end && start <= today && end >= today
      && String(r[positions[4]] || '').toUpperCase() === 'ATIVO'
      && String(r[positions[5]] || '') === '1'
      && String(r[positions[6]] || '').toUpperCase() === 'TODOS'
      && dgmbLandingValor_(r[positions[3]]) !== null;
  });
  // Lotes simultaneos de mais de uma campanha sem vinculo nao sao confiaveis.
  if (candidates.length !== 1) return null;
  var r = candidates[0], match = /Lote\s*(\d+)/i.exec(String(r[positions[0]] || ''));
  if (!match) return null;
  var numero = Number(match[1]);
  if (!Number.isInteger(numero) || numero < 1) return null;
  return {
    numero: numero, valor: dgmbLandingValor_(r[positions[3]]),
    inicio: dgmbLandingDataISO_(r[positions[1]]),
    fim: dgmbLandingDataISO_(r[positions[2]])
  };
}

function dgmbLandingSituacaoOficial_(ss, desafio) {
  var today = dgmbLandingHoje_();
  var lote = dgmbLandingLoteAtual_(ss, today);
  var base = {
    status: 'INDISPONIVEL',
    desafio: {id: desafio.id, modalidade: desafio.modalidade, inicio: desafio.inicio},
    loteAtual: lote ? lote.numero : null,
    lotes: lote ? [lote] : []
  };
  if (desafio.fim && today > desafio.fim) { base.status = 'ENCERRADO'; return base; }
  if (desafio.inicio && today < desafio.inicio) { base.status = 'EM_BREVE'; return base; }
  if (!desafio.permite || String(desafio.status).toUpperCase() !== 'ATIVO') {
    base.status = 'PAUSADO';
    return base;
  }
  // O cadastro de ListaDesafios e os PixLotes nao informam a capacidade.
  // Sem a funcao do controle oficial de inscricoes, NAO anunciar ABERTO.
  if (typeof dgmbLandingConsultaDisponibilidadeOficial_ !== 'function') return base;
  var fonte;
  try {
    fonte = dgmbLandingConsultaDisponibilidadeOficial_(desafio.id, desafio.modalidade);
  } catch (error) { return base; }
  if (!fonte || typeof fonte !== 'object') return base;
  var status = String(fonte.status || '').trim().toUpperCase();
  var vagas = Number(fonte.vagasDisponiveis);
  var validaVagas = fonte.vagasDisponiveis !== null && fonte.vagasDisponiveis !== undefined
    && fonte.vagasDisponiveis !== '' && Number.isInteger(vagas) && vagas >= 0;
  if (status === 'ESGOTADO' || (validaVagas && vagas === 0)) {
    base.status = 'ESGOTADO';
    base.vagasDisponiveis = 0;
  } else if (status === 'PAUSADO' || status === 'ENCERRADO' || status === 'EM_BREVE') {
    base.status = status;
  } else if (status === 'ABERTO' && validaVagas && vagas > 0 && lote) {
    base.status = 'ABERTO';
    base.vagasDisponiveis = vagas;
    // Nao publicar link direto antes de confirmar o handoff em producao.
    // Se houver contrato validado, alterar APENAS este ponto e testar.
  }
  return base;
}
