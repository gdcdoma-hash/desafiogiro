# Ponte de API pública — Landing Pages / Admin Giro

## Escopo desta entrega

O código \`LandingPublicApi.gs\` é um adaptador **somente leitura** para o projeto Apps Script que realmente hospeda o Admin das Landing Pages. Não é um novo site, não cria banco, não altera campanhas nem recebe inscrições.

A base real foi conferida em 20/11/2026:
- \`LandingCampanhas\`: \`slug | rascunho_json | publicado_json | versao | atualizado_em\`.
- \`ListaDesafios\`: colunas \`id_Desafio_lista\`, \`Status\`, \`Data_Inicio\`, \`Data_Fim\`, \`Permite_Inscricao\`, \`Modalidade_Esportiva\`.
- \`PixLotes\`: lotes globais por data e quantidade de inscrições. Para exibição individual, a ponte considera **somente** lote ativo no dia, com quantidade 1 e tipo TODOS, desde que exista **exatamente um** lote compatível.
- Campanhas atuais: \`selim\` → ID \`166\` / \`CICLISMO\`; \`50tao\` → ID \`167\` / \`CAMINHADA_CORRIDA\`.

## Ativação controlada no Apps Script correto

1. Identificar a implantação/versão do **Admin Giro que contém o módulo Landing Pages**. Não presumir que o repositório de inscrições ou Meu Giro seja esse projeto.
2. Adicionar o conteúdo de \`LandingPublicApi.gs\` ao Apps Script do Admin, em um arquivo próprio. **Não** declarar outro \`doGet\`.
3. No início do \`doGet(e)\` já existente, antes do HTML, inserir:

\`\`\`javascript
if (e && e.parameter && e.parameter.api === 'landing-campanha-v1') {
  return dgmbLandingPublicApi_(e);
}
\`\`\`

4. A ponte tenta usar \`SpreadsheetApp.getActiveSpreadsheet()\` se o script for vinculado à planilha de produção. Se o script não estiver vinculado, configurar a propriedade de script \`DGMB_SPREADSHEET_ID\` com o ID da planilha correta. **Não** incluir ID, tokens, contas ou chaves em repositório/HTML.
5. Integrar ao módulo oficial de controle de inscrições/medalhas a função abaixo, que **não vem implementada** porque precisa usar o cadastro real de capacidades e inscrições:

\`\`\`javascript
function dgmbLandingConsultaDisponibilidadeOficial_(idDesafio, modalidade) {
  // Consultar a fonte oficial usada para liberar/bloquear inscricoes.
  // Retornar, por exemplo: {status:'ABERTO', vagasDisponiveis:25}
  // Se nao for possivel validar vagas ou status, retornar:
  return {status:'INDISPONIVEL'};
}
\`\`\`

6. Publicar uma **nova versão** de teste do Apps Script, confirmar permissões, validar \`?api=landing-campanha-v1&campanha=selim&callback=dgmbLanding_1795180000000_1\` e testar \`50tao\` e slug inexistente. A resposta só pode conter dados públicos.
7. Confirmar que o endpoint do frontend aponta para a implantação correta. Se a implantação mudar de URL, atualizar o frontend **em homologação** primeiro e testar antes de aplicar em produção.

## Contrato e falhas seguras

- \`status: 'NAO_PUBLICADO'\` se slug inválido, inexistente ou se não houver \`publicado_json\`.
- \`status: 'INDISPONIVEL'\` se JSON ou relacionamento de modalidade/ID for inconsistente, sem expor detalhes de erro.
- \`status: 'OK'\` somente com configuração publicada e vínculo real em \`ListaDesafios\`.
- \`inscricoes.status: 'ABERTO'\` **exige ao mesmo tempo** autorização do módulo oficial, quantidade de vagas válida e positiva, desafio ativo/permitido, período vigente e lote individual válido. Sem consulta oficial de vagas, o estado permanece \`INDISPONIVEL\`.
- \`ESGOTADO\`, \`PAUSADO\`, \`EM_BREVE\`, \`ENCERRADO\` são estados consultivos. O Portal continua sendo o responsável por permitir ou negar a inscrição.
- Nunca enviar campos de CPF, WhatsApp, pagamento, PIX, comprovantes, rascunhos, dados internos, nem detalhes de erros. A lista de campos publicados é explícita.
- Não anunciar URL de inscrição direta: os dois cadastros publicados têm \`destino_confirmado_em_prod=false\`. O botão deve continuar apontando para a entrada principal até validação do handoff.
- Não confiar em lotes globais para calcular vagas: as capacidades de medalhas são controladas em outro módulo. Se no futuro houver dois lotes simultâneos sem vínculo de campanha, o preço público fica indisponível em vez de adivinhar.

## Testes

\`\`\`bash
node --test tests/landing-api-bridge.test.cjs tests/landing-modelos.test.cjs tests/landing-motor-unificado.test.cjs
\`\`\`

Os testes verificam origem \`publicado_json\`, filtros de dados privados, correspondência de desafio/modalidade, regras de lote, esgotamento, ausência de dados, callback JSONP e impossibilidade de anunciar inscrições sem vagas confirmadas.

## Pendências que não devem ser tratadas como prontas

- Código do Apps Script administrativo real ainda não foi encontrado nos repositórios conectados. **A ponte está versionada e testável, mas não foi instalada no Admin nem homologada em produção**.
- A integração do cálculo de vagas com a função oficial continua pendente.
- O link direto de inscrição (CPF + desafio certo) depende de homologação do Portal.
- O compartilhamento por WhatsApp requer Open Graph no HTML servido pelo domínio, não apenas metadados alterados por JavaScript.
