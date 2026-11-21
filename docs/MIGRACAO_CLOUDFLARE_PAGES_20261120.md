# Desafio Giro — migração de landing pages para Cloudflare Pages (preparação)

**Estado:** somente proposta de preparação. Nenhum projeto Cloudflare foi criado e nenhum domínio foi migrado por esta alteração.

## Motivo
A Vercel atual está no plano Hobby; precisamos validar uma hospedagem adequada ao uso comercial sem assumir custos fixos. Cloudflare Pages estático é uma opção; verificar os termos e o consumo real da conta antes de ativar.

## Arquitetura preservada
- Repositório único: `gdcdoma-hash/desafiogiro`.
- Domínio oficial: `desafiogiro.gmbd.com.br`.
- Raiz `/`: mantém tela de entrada e direcionamento para o Web App Apps Script existente.
- `/desafios/selim/`, `/desafios/50tao/`: mantém HTML editorial.
- `/desafios/<slug>/`: mantém template compartilhado e leitura JSONP do Apps Script via `landing/campanha.js`.
- **O Admin, a ListaDesafios, pagamentos e inscrições não são migrados por esta alteração.**

## Configuração futura do projeto Pages
- Criar projeto Pages **na conta Cloudflare apropriada e auditada**, sem misturar NOMA ou Loja GMB.
- Vincular GitHub `gdcdoma-hash/desafiogiro` e selecionar `main` somente após a homologação da proposta.
- Build command: `node scripts/build-cloudflare-pages.mjs`.
- Build output directory: `dist-cloudflare-pages`.
- Framework preset: nenhum.
- Não adicionar Pages Functions nem Workers; as rotas são reescritas estaticamente em `_redirects`.
- Validar inicialmente um endereço `*.pages.dev`, **sem CNAME e sem retirar o domínio da Vercel**.

## Passos de homologação (obrigatórios)
1. Validar o workflow de testes no PR, inclusive o empacotamento de todos os recursos.
2. Testar a URL temporária Pages em aba anônima e celular, HTTPS e caminhos com e sem barra final.
3. Testar raiz, landing Selim, landing 50tão e uma nova campanha usando `/desafios/<slug>/`.
4. Confirmar retorno público do endpoint Apps Script em janela anônima, estados ABERTO, ESGOTADO, EM_BREVE, NAO_PUBLICADO e falha da API.
5. Conferir nomes, imagens, datas, preços, lote e se botão de inscrição alcança o desafio e modalidade corretos; o backend Admin ainda precisa de integração própria.
6. Conferir prévias em WhatsApp. Metadados inseridos por JS não atendem todos os rastreadores: campanhas novas exigem plano separado para OG por rota.
7. Medir uso/cotas da conta Cloudflare e confirmar se é realmente gratuita e apropriada ao Giro.
8. Só após testes: adicionar Custom Domain no Pages e **então** ajustar CNAME no provedor DNS; preservar rollback documentado.
9. Não desativar Vercel nem apagar contas/projetos antes da verificação do domínio definitivo e fluxo real de inscrição.

## Rollback
Manter o domínio e o deploy Vercel atuais até que todos os testes acima terminem. Se o domínio for migrado e houver falha, restaurar o registro DNS anterior (documentar valor original antes da troca) e revalidar HTTPS. Não alterar banco, Apps Script ou repositórios de terceiros.

## Limitações desta entrega
O CI apenas valida arquivos/rotas por testes locais; não equivale a teste real da rede Cloudflare. Sem conexão à conta Cloudflare, não é possível comprovar cota ou criar preview Pages nesta etapa. A criação do projeto e o cutover de DNS ficam separados desta proposta.

## Auditoria operacional em 21/11/2026 — bloqueio comercial confirmado
- Auditoria somente leitura pelo GitHub Actions, sem gravar payload da API, executada contra o endpoint Apps Script público usado pelas landing pages.
- As campanhas `selim` e `50tao` responderam `OK`, com `inscricoes.status=ABERTO`, mas **sem saldo de vagas verificável em `inscricoes.vagasDisponiveis`**. Vínculo e lote válido foram confirmados pelo diagnóstico.
- O frontend recebeu correção na produção via PR #186 (`gdcdoma-hash/desafiogiro`) para **nunca anunciar abertura sem saldo inteiro e positivo**. Confirmar que esta proteção permaneça na versão Cloudflare.
- A API correta do Admin encontra-se na branch `lab/admin-homologacao` de `gdcdoma-hash/dgmb-inscricoes-repescagem`. A sincronização LAB do workflow `sync-gas-lab.yml` falhou **antes de executar etapas**, portanto o deploy do backend não está comprovado.
- Sem evidência de saldo oficial correto e sem teste Cloudflare `*.pages.dev`, a migração do domínio **não deve ser liberada**. O build CI pode estar verde enquanto a homologação comercial está pendente.
- Não cadastrar recursos na conta Cloudflare do NOMA ou Loja GMB por conveniência. Selecionar uma conta apropriada somente depois de identificar proprietário, plano, limites e impactos cruzados.

## Critérios de saída para liberação
- [ ] Consulta pública de cada campanha retorna ID e modalidade coerentes.
- [ ] Em `ABERTO`, existe lote válido, saldo inteiro positivo e botão seguro. Em `ESGOTADO`, não anuncia abertura.
- [ ] Fluxo de inscrição é validado no Portal com modalidade certa, sem gerar inscrição de teste em produção.
- [ ] Teste de uma campanha nova no modelo neutro, sem imagens ou preços de medalhas antigas.
- [ ] Prévia Cloudflare com rotas e SSL válidos, em conta auditada, sem alteração de DNS.
- [ ] Metadados de compartilhamento e indexação homologados para campanha real.
- [ ] Reversão de DNS e hospedagem documentada com valores anteriores.
