# Domínio: Desafios — ciclo 1

## Objetivo

Definir as regras funcionais mínimas do módulo **Desafios** antes de criar tabelas novas no banco. O módulo deve servir como base para inscrições, estoque, financeiro, Meu Giro e futuras integrações, sem repetir a rigidez da planilha atual.

## Princípios

1. Um **Desafio** representa a edição/período principal da experiência, e não um lote de venda isolado.
2. Regras comerciais de inscrição devem ser configuráveis e separadas do cadastro principal do desafio.
3. Metas de quilometragem devem ser dados configuráveis, não colunas fixas nem regras codificadas.
4. Regras históricas precisam permanecer consultáveis mesmo depois de encerradas.
5. Alterações administrativas relevantes devem ser auditáveis.
6. Nenhuma exclusão física deve ser usada para apagar histórico que já tenha inscrições vinculadas.
7. O módulo deve ser independente da planilha antiga. A migração histórica será feita de forma saneada em etapa própria.

## Conceitos do domínio

### Desafio

É a edição principal que possui identidade, período esportivo e estado operacional.

Informações funcionais previstas:

- identificador interno imutável;
- código legível/slug;
- nome público;
- descrição curta;
- data/hora de início;
- data/hora de término;
- fuso horário de referência;
- status;
- indicação de visibilidade pública;
- observações administrativas;
- timestamps de criação e alteração.

O período esportivo determina quando atividades podem contar para a edição. Prazo de inscrição não deve ser confundido com esse período.

### Meta

Cada desafio poderá oferecer uma ou mais metas de quilometragem.

Exemplos já utilizados no negócio incluem 100 km, 300 km, 500 km e 800 km, mas o sistema não deve limitar a essas opções.

Cada meta deve poder ter:

- quilometragem-alvo;
- nome/rótulo público opcional;
- ordem de exibição;
- estado ativo/inativo para novas inscrições;
- configuração futura de medalha ou item físico associado.

Uma meta que já tenha sido utilizada em inscrições não deve ser apagada fisicamente apenas porque deixou de ser oferecida.

### Oferta de inscrição

Representa uma janela/regra comercial pela qual uma pessoa pode entrar em um desafio.

A separação entre **Desafio** e **Oferta de inscrição** é necessária porque uma mesma edição pode ter preços, prazos e modalidades diferentes ao longo do tempo.

Cada oferta poderá definir:

- nome interno e nome público;
- tipo/categoria da oferta;
- início e fim da janela de inscrição;
- preço;
- prioridade/ordem de aplicação;
- quantidade máxima por participante quando aplicável;
- estado ativo/inativo;
- regras específicas configuráveis.

A nomenclatura comercial não deve ficar presa a `NORMAL` e `REPESCAGEM`. Esses nomes podem existir como categorias iniciais, mas a estrutura deve permitir mais de uma oferta equivalente no mesmo período, inclusive cenários em que existam duas ofertas consideradas normais com regras ou prazos distintos.

## Regras consolidadas que o novo modelo precisa suportar

- Uma edição pode ter diferentes janelas de preço ao longo do período de inscrição.
- A quantidade permitida de inscrições por modalidade deve ser configurável pelo administrador e não gravada como regra fixa no código.
- O histórico atual de "1 normal + até 3 repescagens" deve ser representável, mas não deve virar uma restrição estrutural permanente do banco.
- Repescagem pode existir como oferta posterior e pode depender de disponibilidade operacional/estoque; essa dependência será definida em conjunto com o módulo de inscrições/estoque, não dentro do cadastro básico do desafio.
- O mesmo conceito de desafio/meta pode reaparecer em períodos diferentes sem conflito de identidade.
- Datas do negócio devem ser tratadas com fuso explícito; a apresentação ao usuário brasileiro continuará em formato local.

## Estados propostos

### Estado do desafio

- `DRAFT`: configuração ainda não disponível ao público;
- `SCHEDULED`: configurado para período futuro;
- `ACTIVE`: período esportivo em andamento;
- `FINISHED`: período esportivo encerrado;
- `ARCHIVED`: mantido apenas para histórico administrativo.

O status não deve depender apenas de cálculo automático de data. A aplicação poderá sugerir transições automáticas, mas deve preservar controle administrativo e histórico.

### Estado da oferta

- `DRAFT`;
- `SCHEDULED`;
- `OPEN`;
- `CLOSED`;
- `DISABLED`.

Uma oferta fechada ou desabilitada permanece registrada para explicar inscrições históricas e valores praticados.

## Validações mínimas

- data final do desafio deve ser posterior à data inicial;
- quilometragem da meta deve ser maior que zero;
- não permitir duas metas ativas idênticas dentro do mesmo desafio sem justificativa explícita;
- valor da oferta não pode ser negativo;
- fim da janela da oferta deve ser posterior ao início;
- uma oferta precisa pertencer a exatamente um desafio;
- alterações em desafio/oferta/meta com inscrições vinculadas não podem reescrever silenciosamente o histórico comercial;
- mudanças sensíveis devem gerar evento de auditoria.

## Regra de imutabilidade histórica

Quando uma inscrição for criada, ela deverá preservar um retrato mínimo das condições comerciais utilizadas (por exemplo, oferta e preço efetivamente aplicado). Assim, alterar uma oferta futura não poderá modificar retroativamente o valor ou a regra de uma inscrição anterior.

A implementação concreta desse snapshot ficará no ciclo de **Inscrições**, mas o módulo Desafios já deve ser desenhado considerando essa exigência.

## Fronteiras com outros módulos

### Participantes

Desafios não armazenam dados pessoais do participante.

### Inscrições

O módulo Inscrições será responsável por vincular participante + desafio + meta + oferta, controlar estado da inscrição, pagamentos e limites efetivos.

### Estoque

O módulo Desafios apenas permitirá referência futura entre meta/oferta e itens físicos. Saldo, reserva e baixa de medalhas pertencem ao domínio Estoque.

### Financeiro

Preço configurado na oferta é condição comercial; recebimento, conciliação, estorno e caixa pertencem ao Financeiro.

### Meu Giro / atividades

O desafio define o período esportivo e a meta. Registro, validação e soma de atividades pertencem ao domínio de atividades/Meu Giro.

## Painel administrativo — ciclo mínimo

Primeira versão funcional do painel de Desafios deve permitir:

- listar desafios;
- filtrar por status/período;
- abrir detalhes de uma edição;
- criar desafio em rascunho;
- editar dados enquanto não houver impacto histórico;
- ativar/desativar visibilidade;
- cadastrar e ordenar metas;
- cadastrar ofertas e seus períodos/preços;
- visualizar claramente quais ofertas estão abertas, futuras ou encerradas;
- impedir exclusão destrutiva de registros já utilizados;
- registrar ações administrativas em auditoria.

## Fora do ciclo 1

Não implementar ainda:

- inscrição de participante;
- reserva/baixa de medalha;
- geração de PIX;
- pagamento;
- repescagem automática;
- importação da planilha histórica;
- sincronização Strava;
- certificado;
- ranking;
- regras de conclusão do desafio.

Esses itens dependerão de domínios posteriores e não devem ser antecipados dentro de Desafios.

## Modelo lógico preliminar — ainda sem migração

A análise indica três entidades principais para a etapa de banco:

- `challenges` — edição/período principal;
- `challenge_goals` — metas oferecidas pela edição;
- `challenge_offers` — janelas e condições comerciais de inscrição.

Esse desenho é preliminar. A migração SQL só deve ser criada depois da revisão final dos campos, constraints, permissões RLS, contratos da API e critérios de migração do legado.

## Decisões ainda pendentes antes do banco

1. Precisamos distinguir formalmente **data esportiva** de **competência/mês de referência** para edições mensais.
2. Definir se uma oferta pode restringir quais metas estão disponíveis ou se todas as metas ativas do desafio ficam disponíveis em toda oferta.
3. Definir se o limite de inscrições por participante pertence à oferta, ao desafio ou a uma política independente reutilizável.
4. Definir tratamento de cancelamento de uma edição que já possua inscrições.
5. Definir se preço será sempre único por oferta ou se poderá variar por meta.
6. Definir o grau de edição permitido após a primeira inscrição vinculada.

Esses pontos devem ser fechados antes de criar as tabelas funcionais.
