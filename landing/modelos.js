/* Geração editorial para campanhas novas: preserva integralmente campos já editados no Admin. */
(function(root,factory){
  const build=factory();
  if(typeof module==='object'&&module.exports)module.exports=build;
  if(root)root.dgmbNormalizarCampanha=build;
})(typeof window==='object'?window:null,function(){
  'use strict';
  const txt=v=>typeof v==='string'?v.trim():'';
  const pick=(...values)=>values.map(txt).find(Boolean)||'';
  const list=(value,fallback)=>Array.isArray(value)&&value.length?value:fallback;
  const nonempty=(value,fallback)=>pick(value,fallback);
  const kmValue=raw=>{
    for(const v of [raw.meta_fixa_km,raw.meta_km,raw.distancia_km,raw.distanciaKM]){
      if(v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0)return Number(v);
    }
    return null;
  };
  function normalize(raw){
    if(!raw||typeof raw!=='object')throw Error('CAMPANHA_AUSENTE');
    const id=pick(raw.id,raw.slug),nome=pick(raw.nome,raw.nome_desafio);
    if(!id||!nome||!/^[a-z0-9][a-z0-9-]{1,69}$/.test(id))throw Error('IDENTIFICACAO_INVALIDA');
    const portal=raw.portal&&typeof raw.portal==='object'?raw.portal:{};
    const value=pick(portal.modalidade,raw.modalidade_esportiva,raw.modalidade).toUpperCase();
    const bike=/CICLISMO|PEDAL|BIKE/.test(value);
    const walk=/CAMINHADA|CORRIDA/.test(value);
    if(bike===walk)throw Error('MODALIDADE_INVALIDA');
    if(!pick(String(portal.id_desafio_lista||'')))throw Error('DESAFIO_SEM_VINCULO');
    const imagens=raw.imagens&&typeof raw.imagens==='object'?raw.imagens:{};
    const principal=pick(imagens.principal,raw.imagem_medalha,raw.url_imagem_medalha);
    if(!principal)throw Error('IMAGEM_OFICIAL_AUSENTE');
    const detalhe=pick(imagens.detalhe,principal);
    const periodo=pick(raw.periodo_desafio,raw.periodo_texto,raw.periodo);
    const meta=kmValue(raw),metaStr=meta?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(meta)+' km':'';
    const atividade=bike?'pedalada':'caminhada ou corrida';
    const acao=bike?'Pedale':'Caminhe ou corra';
    const verb=bike?'pedalar':'caminhar e correr';
    const frase=pick(raw.frase_marca,bike?'Cada pedalada, uma conquista.':'Cada passo, uma conquista.');
    const periodoMsg=periodo?' em '+periodo:' no período válido do desafio';
    const metaMsg=metaStr?'Some '+metaStr+periodoMsg+'.':'Escolha uma meta disponível no Portal Giro e complete-a no período do desafio.';
    const intro=bike?'O importante é se desafiar e registrar suas pedaladas, no seu ritmo.':'Caminhe, corra ou combine as duas atividades de acordo com seu ritmo e condicionamento.';
    const descricao='Participe do '+nome+'. '+metaMsg+' '+intro;
    const defaults={
      hero_titulo:nome+'.',
      hero_destaque:'Sua próxima conquista começa aqui.',
      hero_subtitulo:bike?'':'',
      hero_descricao:descricao,
      nota_portal:'Valores, lotes, vagas e condições são atualizados pelo Portal Giro.',
      intro_chamada:bike?'':'',
      intro_titulo:'Cada quilômetro conta.',
      intro_destaque:'A conquista é sua.',
      intro_texto:'Não é preciso competir com outras pessoas. Defina seu objetivo e siga o regulamento da edição. '+intro,
      como_funciona:'Quatro passos para participar do desafio no seu ritmo.',
      medalha_titulo:'Mais do que uma medalha.',
      medalha_destaque:'Um símbolo da sua jornada.',
      medalha_descricao:'A medalha representa sua dedicação à modalidade. A entrega e a conclusão dependem da validação e das condições informadas pelo Portal Giro.',
      galeria_descricao:'Conheça a medalha oficial e os detalhes desta edição.',
      frase_motivacional:'A próxima conquista começa com sua decisão de participar.',
      faq_intro:'As informações oficiais sobre prazos, inscrições e entrega são apresentadas no Portal Giro.',
      final_titulo:'Sua próxima conquista.',
      final_destaque:'No seu ritmo.',
      final_texto:'Participe do '+nome+'. Consulte os critérios e a disponibilidade de inscrições no Portal Giro.'
    };
    defaults.hero_subtitulo=bike?'Para quem tem paixão por pedalar.':'Para quem encontra seu ritmo a cada passo.';
    defaults.intro_chamada=bike?'CICLISMO':'CAMINHADA E CORRIDA';
    const texto={...defaults};
    for(const [k,v] of Object.entries(raw.texto||{}))if(typeof v==='string'&&v.trim())texto[k]=v;
    const destaques=[
      {titulo:metaStr?'Meta de '+metaStr:'Uma meta para você',descricao:metaStr?'Complete os quilômetros previstos na edição.':'Escolha entre as metas disponibilizadas no Portal Giro.'},
      {titulo:'No seu ritmo',descricao:bike?'Pedale respeitando seus limites.':'Caminhe, corra ou combine as duas atividades.'},
      {titulo:'Conquista reconhecida',descricao:'A conclusão depende de conferência, conforme regulamento.'}
    ];
    const passos=[
      {icone:'01',titulo:'Faça sua inscrição',descricao:'Acesse o Portal Giro, entre com seu CPF e selecione este desafio.'},
      {icone:'02',titulo:acao+' no seu ritmo',descricao:metaMsg},
      {icone:'03',titulo:'Registre suas atividades',descricao:'Registre os quilômetros conforme as regras oficiais da modalidade.'},
      {icone:'04',titulo:'Confirme sua conclusão',descricao:'Acompanhe sua situação no Meu Giro e aguarde a validação.'}
    ];
    const perguntas=[
      {pergunta:'Como faço minha inscrição?',resposta:'Acesse o Portal Giro, confira se as inscrições desta edição estão abertas e siga as instruções apresentadas.'},
      {pergunta:'Qual é a meta e o prazo do desafio?',resposta:metaMsg+' O período e as condições oficiais prevalecem no Portal Giro.'},
      {pergunta:'Como comprovo os quilômetros?',resposta:'Registre suas atividades pelos meios aceitos no regulamento da edição. A organização pode realizar conferência antes de aprovar a conclusão.'},
      {pergunta:'Qual é o valor da inscrição?',resposta:'O valor e o lote vigente são informados pelo Portal Giro. Consulte a disponibilidade antes de se inscrever.'},
      {pergunta:'Quando recebo a medalha?',resposta:'A entrega depende das condições da edição, da confirmação da conclusão e dos procedimentos informados pela organização.'}
    ];
    const gallery=[{arquivo:principal,legenda:'Medalha oficial '+nome,alt:pick(imagens.principal_alt,'Medalha oficial '+nome)}];
    if(detalhe!==principal)gallery.push({arquivo:detalhe,legenda:'Detalhes da medalha',alt:pick(imagens.detalhe_alt,'Detalhes da medalha '+nome)});
    const coresBase=bike?{fundo:'#0b0b0d',fundo_secundario:'#151316',destaque:'#f9bf3c',destaque_escuro:'#da9e22',destaque_claro:'#ffe084',fundo_claro:'#f6f4f0'}:{fundo:'#0b0b0d',fundo_secundario:'#171319',destaque:'#fa8754',destaque_escuro:'#de683c',destaque_claro:'#ffb58a',fundo_claro:'#f6f4f0'};
    return {
      ...raw,id,nome,modalidade:pick(raw.modalidade,bike?'Ciclismo':'Caminhada/Corrida'),
      frase_marca:frase,
      seo_descricao:pick(raw.seo_descricao,descricao),
      portal:{...portal,modalidade:pick(portal.modalidade,bike?'CICLISMO':'CAMINHADA_CORRIDA')},
      texto,cores:{...coresBase,...(raw.cores||{})},
      imagens:{...imagens,principal,detalhe,principal_alt:pick(imagens.principal_alt,'Medalha oficial '+nome),detalhe_alt:pick(imagens.detalhe_alt,'Detalhes da medalha '+nome),cenario:pick(imagens.cenario),compartilhamento:pick(imagens.compartilhamento,principal)},
      botoes:{principal:'Quero me inscrever',secundario:'Como participar',final:'Participar do desafio',...(raw.botoes||{})},
      destaques:list(raw.destaques,destaques),
      passos:list(raw.passos,passos),
      caracteristicas_medalha:list(raw.caracteristicas_medalha,[{titulo:'Medalha oficial',descricao:'Um símbolo da sua conquista.'},{titulo:'Registro da modalidade',descricao:bike?'Celebre sua dedicação ao ciclismo.':'Celebre sua dedicação à caminhada e corrida.'}]),
      perguntas:list(raw.perguntas,perguntas),
      galeria:list(raw.galeria,gallery)
    };
  }
  return normalize;
});
