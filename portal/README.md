# Portal Giro V1 — Desenvolvimento

Esta pasta contém a interface pública do Portal Giro em desenvolvimento isolado.

## Regra de proteção

- `main` = produção atual.
- O `index.html` da raiz do repositório é o redirecionador em produção e não deve ser alterado durante o desenvolvimento do Portal.
- Todo o trabalho da nova interface permanece dentro de `/portal/` na branch `dev` até aprovação explícita para publicação.

## Estrutura atual

- `portal/index.html` — Home pública V1.
- `portal/css/portal.css` — estilos gerais da Home.
- `portal/css/navigation.css` — ajustes específicos da navegação e rolagem.
- `portal/js/portal.js` — menu mobile, preservação de parâmetros de origem/REF e navegação contextual.

## Hierarquia visual aprovada

1. Desafio Giro — destaque principal.
2. Giro Motos Bikes — segundo grande pilar do ecossistema.
3. Meu Giro — serviço importante para o participante, sem competir visualmente com o Desafio Giro.

## Integrações atuais

- Inscrição do Desafio Giro: utiliza o redirecionador existente na raiz e preserva os parâmetros recebidos, incluindo `ref`.
- Meu Giro: Google Apps Script oficial.
- Giro Motos Bikes: Instagram oficial, grupo público de WhatsApp e contato por WhatsApp.

## Links ainda não implementados

Agenda, Eventos, Grupos e página pública de regras/regulamento permanecem sem destino definitivo enquanto não houver especificação aprovada para essas páginas.

## Regras de desenvolvimento

- Não criar APIs ou autenticação unificada sem aprovação.
- Não redefinir regras de negócio no código do Portal.
- Não substituir o redirecionador atual antes de análise específica de compatibilidade.
- Validar alterações na URL de Preview da branch `dev` antes de qualquer plano de publicação.
