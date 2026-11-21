# Landing Pages 2.0 — Integração Admin/Portal Giro

Status em 20/11/2026: o Admin real ja tem `landing-campanha-v1` na branch `lab/admin-homologacao` do repositorio `dgmb-inscricoes-repescagem`. As correcoes de saldo oficial e DTO publico foram incorporadas no PR #485, commit `a862bff`. **Nao instalar ponte paralela.** O workflow de sincronizacao para Apps Script LAB falhou antes de executar etapas; nao ha comprovacao de deploy LAB nem PRODUCAO. As landing pages estaticas no Vercel seguem independentes desse deploy.

## Fonte canonica e proxima implantacao
- **Admin Apps Script (unico backend):** https://github.com/gdcdoma-hash/dgmb-inscricoes-repescagem/tree/lab/admin-homologacao
- **Alteracao incorporada:** https://github.com/gdcdoma-hash/dgmb-inscricoes-repescagem/pull/485
- **Workflow LAB com falha de inicializacao (nao houve push):** https://github.com/gdcdoma-hash/dgmb-inscricoes-repescagem/actions/runs/44802022047
- **Pagina publica:** o motor no Vercel le a API que estiver efetivamente implantada, nao executa arquivos `.gs` do repositorio estatico.
- O backend reutiliza `LandingCampanhas` (`publicado_json`), `ListaDesafios`, `PixLotes` e o catalogo de inscricoes; capacidade por desafio Normal e definida pelas propriedades `DGMB_CAPACIDADE_MEDALHAS_<id>` e vagas resultam das inscricoes comprometidas.
- Publicacao so deve ser considerada concluida apos confirmar a versao Apps Script, consulta real do endpoint, periodo, modalidade, lotes, capacidade e teste de inscricao.

## Objetivo
O cadastro de desafio no Admin deve ser a fonte única de verdade para **modalidade, meta, datas, lote, preço, inscrições e disponibilidade**. As páginas públicas reutilizam o template responsivo e a configuração editorial da campanha. Nunca copiar preços e prazos para HTML ou JavaScript.

## Endereços
- Domínio principal: https://desafiogiro.gmbd.com.br/
- URLs públicas automáticas: /desafios/<slug>/
- Roteamento genérico existente: /landing/index.html?campanha=<slug>
- 50tão permanece com template editorial próprio; a lógica comercial é idêntica.
- Não criar novo projeto de hospedagem para cada campanha.

## Contrato atual do motor
Requisição JSONP já suportada:
GET {endpoint Apps Script}?api=landing-campanha-v1&campanha=<slug>&callback=<nome_validado>
A resposta deve ser gerada pelo backend com sanitização rigorosa de callback e dados de publicação:
{
  "status":"OK",
  "campanha":{
    "id":"slug-publicado",
    "nome":"Nome da Medalha",
    "modalidade":"CICLISMO",
    "portal":{"id_desafio_lista":"ID_REAL","modalidade":"CICLISMO"},
    "texto":{ "...":"campos editoriais conforme landing/campanha.js" },
    "cores":{ "...":"cores da campanha" },
    "imagens":{ "...":"URLs HTTPS ou arquivos aprovados em /landing/assets" },
    "galeria":[],
    "perguntas":[],
    "destaques":[],
    "passos":[],
    "caracteristicas_medalha":[]
  },
  "inscricoes":{
    "status":"ABERTO",
    "desafio":{"id":"ID_REAL","modalidade":"CICLISMO","inicio":"2026-12-01"},
    "loteAtual":1,
    "lotes":[{"numero":1,"valor":59.90,"inicio":"2026-11-20","fim":"2026-11-30"}],
    "vagasDisponiveis":25,
    "url_inscricao":"https://desafiogiro.gmbd.com.br/?desafio=ID_REAL"
  }
}
O endereço de inscrição acima é **ilustrativo**: só publicar o deep link se o Portal realmente reconhecer o parâmetro e selecionar o desafio correto. Do contrário, omitir url_inscricao; a página usará https://desafiogiro.gmbd.com.br/ como caminho seguro.

## Regras obrigatórias no Admin
1. Ao salvar uma campanha, vincular um único registro real da ListaDesafios pelo ID e modalidade. Não permitir cruzar caminhada/corrida com ciclismo ou vincular medalha errada.
2. Preencher preços/lotes diretamente do módulo oficial de inscrições, inclusive em alterações futuras. Status ABERTO só quando o backend confirma período, lote atual, modalidade, desafio e vagas.
3. Expor disponibilidade calculada pelo mesmo controle de vagas usado nas inscrições. Se o limite estiver zerado, retornar ESGOTADO ou vagasDisponiveis=0.
4. Estados aceitos: NAO_CADASTRADO, EM_BREVE, ABERTO, PAUSADO, ESGOTADO, ENCERRADO, INDISPONIVEL. Falha de leitura não deve inventar abertura.
5. Publicação com prévia e botão Publicar; antes disso retornar NAO_PUBLICADO. Arquivar após encerramento, preservando histórico.
6. Usar modelos editoriais por modalidade, com ajuste automático de expressões (pedalar vs caminhar/correr), meta fixa/variável, limites e regulamento; sem inserir textos publicitários incompatíveis com regras reais.
7. Só exibir imagens vinculadas à campanha. Aprovar/otimizar WebP e armazenar as imagens oficiais; não reaproveitar automaticamente a medalha de outra campanha.
8. O JSONP é público e deve conter apenas dados da campanha; nunca CPF, WhatsApp, contato de atleta, chave de API ou informações administrativas.
9. Validar backend de destino a cada atualização de preços e status; a página pública consulta a API a cada 60 s, e quando a aba volta ao primeiro plano.
10. Editar a campanha não deve exigir commit no GitHub. A própria configuração publicada deve atualizar a página.

## Regras do frontend nesta alteração
- Valores lidos de inscricoes.lotes[] e formatados em BRL; não há bloqueio por preços de 2026.
- Quando não há lotes válidos, exibir "Consulte os valores no Portal Giro".
- ABERTO exige correspondência exata entre ID e modalidade da campanha e do desafio, lote válido e ausência de indicação de estoque zero.
- A página nunca executa inscrição; apenas encaminha. Toda regra de venda precisa permanecer no Portal.
- Para link direto, aceita apenas URL HTTPS no host desafiogiro.gmbd.com.br. Caso contrário, direciona para a raiz oficial.
- O renderer continua a usar os campos editoriais da API no template compartilhado.

## Limitações a resolver antes da publicação
- O backend correto está no repositório `gdcdoma-hash/dgmb-inscricoes-repescagem`, branch `lab/admin-homologacao`, arquivos `LandingPublicaService.gs`, `AdminLandingCampanhasService.gs`, `InscricaoCatalogoV2Service.gs` e `AdminControleInscricoesService.gs`. O `doGet` já despacha `landing-campanha-v1`. Falta **confirmar implantação real no Apps Script**: o `sync-gas-lab.yml` falhou antes do primeiro passo em 20/11/2026 e a versão PROD não foi validada. Não confundir commit no GitHub com código publicado no Apps Script.
- Prévia social (Open Graph) gerada pelo JavaScript não é suficiente para robôs de WhatsApp e redes sociais. Para imagem/título específicos por campanha, implementar metadados HTML servidos ao rastreador, por rota, sem depender da execução do navegador.
- Não há prova de que o link direto com ?desafio=ID seja reconhecido; confirmar o handoff com o Portal antes de ativar links profundos.
- O endpoint da API existente não pôde ser validado em ambiente de produção por ferramentas de inspeção da sessão. A integração total **não está homologada**.

## Testes antes de liberar
- Ciclo NAO_PUBLICADO -> EM_BREVE -> ABERTO -> ESGOTADO/ENCERRADO (inclusive aba já aberta e celular).
- Mesma modalidade, ID errado; mesma ID, modalidade errada; lote ausente; preço alterado; preço inválido; 0 vagas.
- Falha/timeout de Apps Script com página já carregada e em primeira visita; sempre oferecer consulta do Portal.
- Link direto funcional para o desafio certo e login via CPF; sem inscrever em modalidade errada.
- Navegação e layout em telas pequenas; prévia WhatsApp mostrando imagem oficial; funcionamento do domínio novo.
- Rodar: node --test tests/landing-motor-unificado.test.cjs

## Operação pretendida após homologação
Admin cadastra desafio -> vincula medalha oficial -> seleciona modelo Ciclismo ou Caminhada/Corrida -> pré-visualiza -> publica. Edições de disponibilidade/preço/status são refletidas sem alterar código.
