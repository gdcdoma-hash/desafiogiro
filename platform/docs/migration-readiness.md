# Prontidão para migração do sistema legado

Este documento organiza a preparação da migração do DGMB em Google Apps
Script/Google Sheets para a nova plataforma. Ele não autoriza importação de dados
reais nem substituição do sistema atual.

A referência do legado é o repositório de backup confiável
`gdcdoma-hash/dgmb-inscricoes-producao-confiavel`. A referência do destino é o
schema versionado em `platform/supabase/migrations` deste repositório.

## Princípio de migração

A migração deve ser repetível, auditável e reconciliável. Nenhuma linha deve ser
copiada diretamente para produção sem passar antes por extração controlada,
normalização, validação e um ensaio de restauração ou reimportação.

O sistema GAS/Sheets permanece a fonte operacional até que exista um plano de
corte aprovado. Durante a preparação, ele deve ser tratado como somente leitura
para fins de análise: não alterar abas, cabeçalhos ou regras antigas para
facilitar o importador novo.

## Estruturas confirmadas no legado

O código confiável referencia explicitamente as seguintes abas principais:

- `DadosPessoais`: cadastro e identidade do participante;
- `ListaDesafios`: configuração das edições/ofertas disponíveis;
- `dgmbDesafios`: inscrições e estado operacional do participante no desafio;
- `DesafioKMEstoque`: itens e disponibilidade de estoque por desafio/meta;
- `DesafiosBase`: catálogo/base visual e identificação dos desafios;
- `LogEstoque`: histórico operacional de alterações de estoque;
- `CONFIG_APP`: configuração visual e operacional da aplicação;
- `INDEX_INSCRICOES_USUARIO`: índice técnico derivado para acelerar consultas.

O legado também possui um identificador de inscrição `ID_INSCRICAO` e utiliza
`ID_DGMB` para relacionar o participante. O código contém aliases históricos de
cabeçalhos, portanto o importador não deve depender da posição fixa de uma
coluna.

## Mapeamento inicial para o modelo novo

### Participantes

Fonte principal: `DadosPessoais`.

Destino principal: `public.participants`.

Regras de preparação:

- preservar uma chave de rastreabilidade para o `ID_DGMB` legado sem transformar
  o identificador antigo em mecanismo de autenticação;
- normalizar nome, cidade, UF e telefone antes da deduplicação;
- não copiar credenciais, segredos ou dados que não tenham função na plataforma
  nova;
- detectar participantes duplicados antes de criar qualquer vínculo com
  inscrições.

### Desafios, ofertas e metas

Fontes principais: `DesafiosBase` e `ListaDesafios`.

Destinos principais:

- `public.challenges`;
- `public.challenge_offers`;
- `public.challenge_goals`;
- `public.challenge_offer_goals`.

O importador deve preservar a separação entre o desafio conceitual, a oferta em
um período específico e as metas de quilometragem disponíveis. IDs iguais em
períodos diferentes não devem ser tratados como duplicidade automática.

### Inscrições

Fonte principal: `dgmbDesafios`.

Destino principal: `public.registrations`.

O `ID_INSCRICAO` legado deve ser usado como chave de rastreabilidade para evitar
que uma reexecução do importador crie a mesma inscrição duas vezes. O vínculo
com participante deve ser resolvido pelo identificador legado previamente
normalizado, nunca por posição de linha na planilha.

Estados antigos precisam ser traduzidos para o ciclo de vida novo por uma tabela
de conversão explícita. Nenhum status desconhecido deve ser convertido por
aproximação silenciosa; ele deve ir para relatório de exceções.

### Pagamentos

Fonte principal: campos de pagamento associados às inscrições em
`dgmbDesafios` e, quando aplicável, referências de lote/PIX mantidas pelo legado.

Destino principal: `public.registration_payments`.

Regras de segurança:

- não migrar chaves PIX temporárias como se fossem cadastro permanente;
- preservar valor efetivamente associado à inscrição quando houver informação
  confiável;
- separar pagamento pendente de pagamento confirmado;
- totais financeiros devem ser reconciliados por período antes do corte;
- qualquer divergência entre status da inscrição e status de pagamento precisa
  aparecer em relatório próprio.

### Estoque

Fontes principais: `DesafioKMEstoque` e `LogEstoque`.

Destinos principais:

- `public.inventory_items`;
- `public.inventory_movements`;
- `public.inventory_reservations`.

A migração não deve copiar apenas um saldo final sem explicar sua origem. O
ensaio precisa definir um saldo de abertura verificável e, quando o histórico
for confiável, preservar movimentos úteis para auditoria. Reservas ligadas a
inscrições devem ser recriadas somente depois que participantes, desafios,
metas e inscrições tiverem sido importados com sucesso.

### Pedidos e entregas de medalhas

O modelo novo já possui estruturas próprias de compra, recebimento, separação e
entrega de medalhas. O legado não deve ser forçado a preencher campos que não
existiam no momento histórico.

Dados antigos de entrega podem ser importados apenas quando houver fonte
inequívoca. Ausência de informação deve permanecer como ausência, e não ser
convertida para entregue, pendente ou recebido por inferência.

## Estruturas que não devem ser migradas como dados de negócio

Algumas estruturas do GAS/Sheets são caches, índices ou detalhes de interface e
não pertencem ao domínio persistente novo. Exemplos:

- `INDEX_INSCRICOES_USUARIO` deve ser reconstruído ou dispensado pela arquitetura
  PostgreSQL, e não copiado;
- configurações visuais de `CONFIG_APP` devem ser avaliadas separadamente do
  cadastro operacional;
- colunas de produção de artes, avatar ou resultado visual não devem contaminar
  cadastro, estoque ou financeiro;
- caches, locks, propriedades de script e IDs de linha da planilha não são
  chaves de negócio.

## Domínios ainda não prontos para migração real

A plataforma atual ainda não cobre integralmente todos os domínios históricos.
Antes de migrar a operação completa, precisam existir decisões e modelo de
destino para pelo menos:

- atividades e quilometragem do `Meu Giro`/Strava;
- certificados e seus artefatos finais;
- fluxo completo de avatares e arquivos de arte;
- qualquer dado histórico cujo uso futuro ainda não esteja definido.

Esses itens não bloqueiam ensaios de desafios, participantes, inscrições,
pagamentos e estoque, mas bloqueiam um corte definitivo do sistema inteiro.

## Ordem segura do importador

A ordem recomendada para cada ensaio é:

1. validar arquivo de entrada, versão e cabeçalhos;
2. importar catálogo de desafios, ofertas e metas;
3. importar participantes deduplicados;
4. importar inscrições com rastreabilidade do `ID_INSCRICAO`;
5. importar pagamentos;
6. criar estoque e saldo de abertura;
7. recriar somente reservas comprováveis;
8. importar dados de entrega que tenham origem inequívoca;
9. executar reconciliação e gerar relatório de exceções.

Se uma etapa estrutural falhar, as dependentes não devem continuar.

## Reconciliação obrigatória

Cada ensaio deve gerar, no mínimo:

- quantidade de participantes de origem, importados, mesclados e rejeitados;
- quantidade de inscrições por mês, desafio, meta e status;
- lista de `ID_INSCRICAO` duplicados ou ausentes;
- inscrições sem participante, desafio, oferta ou meta correspondente;
- pagamentos por status e soma de valores por período;
- divergências entre pagamento e estado da inscrição;
- saldo de estoque por desafio/meta antes e depois da importação;
- reservas órfãs ou acima da disponibilidade;
- registros ignorados e o motivo exato de cada rejeição.

A comparação deve utilizar contagens e somatórios agregados. Dados pessoais não
devem ser despejados em logs de CI ou relatórios públicos.

## Idempotência

O importador deve poder ser executado novamente contra um banco de ensaio sem
multiplicar registros. Para isso, cada entidade migrada precisa ter uma chave de
rastreabilidade do legado ou uma regra determinística de correspondência.

Uma segunda execução com a mesma entrada deve resultar em zero novas entidades
inesperadas e no mesmo relatório de reconciliação, salvo campos técnicos como
horários de execução.

## Fases antes do corte

### Fase A — inventário estrutural

Comparar abas e cabeçalhos do snapshot confiável com o contrato esperado pelo
importador. Nenhum dado é gravado no Supabase remoto.

### Fase B — exportação controlada

Gerar arquivos de migração fora do código-fonte, com acesso restrito. Os
arquivos contendo dados reais nunca entram no Git.

### Fase C — ensaio com dados fictícios

Validar parser, transformações, idempotência e relatórios usando fixtures
inventadas no CI e Supabase local.

### Fase D — ensaio isolado com snapshot real

Executar somente em ambiente explicitamente preparado para migração, com acesso
restrito e backup. O objetivo é medir divergências, não operar o desafio.

### Fase E — reconciliação e aceite

Comparar os resultados do legado com o destino e resolver todas as exceções que
possam alterar participantes, inscrições, pagamentos ou estoque.

### Fase F — corte

Só ocorre após decisão explícita, backup independente, janela definida, plano de
reversão e congelamento temporário das escritas no sistema antigo.

## Próximo artefato técnico

O próximo passo executável sem dados reais é criar um contrato de importação e
fixtures fictícias para os cinco primeiros domínios: desafios, participantes,
inscrições, pagamentos e estoque. Esse contrato deve validar cabeçalhos, tipos,
chaves de rastreabilidade e gerar um relatório de reconciliação sem incluir PII
nos logs.
