# Acesso do participante — V1

## Objetivo

O Meu Giro V1 só é disponibilizado para uma conta Supabase Auth vinculada a um
registro de `participants`. A V1 usa convite administrativo; cadastro público de
contas permanece desativado.

## Fluxo

1. um administrador com `participants.manage` seleciona o participante e informa
   o e-mail que receberá o acesso;
2. o frontend envia a solicitação autenticada ao Worker da API;
3. o Worker valida a sessão e a permissão administrativa usando a chave pública;
4. somente no Worker, a `SUPABASE_SERVICE_ROLE_KEY` é usada para enviar o convite
   pelo Supabase Auth e gravar `participant_user_links`;
5. o link do convite retorna para a aplicação web; depois da autenticação,
   `current_participant_id()` resolve o participante e o Meu Giro é exibido.

## Segurança

- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ser enviada ao navegador, commitada ou
  armazenada como variável pública do Vite;
- a API aceita apenas sessão administrativa válida e exige
  `participants.manage`;
- um participante não pode receber dois vínculos ativos e uma conta não pode ser
  vinculada a dois participantes;
- o evento de auditoria registra o participante e o resultado, mas não grava o
  e-mail do convite em metadados;
- cadastro público de usuários continua desativado na V1.

## Limites da V1

Se o e-mail informado já pertencer a uma conta Auth existente mas ainda não
estiver vinculado a um participante, o convite pode ser recusado pelo Supabase.
Esse caso deve ser tratado administrativamente; não será feita busca ampla de
usuários Auth por e-mail no frontend.
