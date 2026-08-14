# Separação de ambientes

A plataforma mantém ambientes separados para impedir que desenvolvimento,
validação e produção compartilhem dados, segredos ou destinos de publicação.
A existência de uma prévia externa não transforma esse ambiente em produção.

## Local

Usa Docker, Supabase local e dados fictícios descartáveis. É o ambiente indicado
para recriação completa do banco, execução das migrations, PgTAP e testes antes
de qualquer integração à branch `dev`.

## Desenvolvimento remoto / prévia administrativa

Existe uma prévia técnica isolada do painel administrativo, publicada fora do
domínio público principal e conectada a um projeto Supabase remoto de
desenvolvimento. Esse ambiente serve para validar autenticação, RLS e os módulos
já migrados sem interferir no GAS, Google Sheets ou Portal público atual.

Regras deste ambiente:

- não usar dados reais durante a fase de construção e testes controlados;
- não reutilizar segredo privilegiado no navegador;
- migrations versionadas no Git são a fonte de verdade do schema;
- alterações de banco devem passar pelo `Foundation checks` antes de serem
  aplicadas ao projeto remoto;
- a URL técnica de prévia não é o endereço definitivo de produção;
- nenhuma publicação nesse ambiente autoriza alteração do domínio principal.

## Homologação

Quando for necessária uma etapa formal de homologação, ela deverá permanecer
isolada de produção e usar recursos próprios ou uma configuração explicitamente
definida para homologação. A passagem de dados reais para esse ambiente não deve
ocorrer por conveniência: precisa fazer parte do plano de migração e proteção de
dados.

## Produção

A produção da nova plataforma continua separada da prévia técnica. Entrada em
produção exigirá, no mínimo:

- validação funcional dos módulos que substituirão o sistema atual;
- estratégia de migração e reconciliação dos dados reais;
- backup independente e teste de restauração;
- configuração definitiva de autenticação, URLs e variáveis;
- plano de corte e reversão;
- autorização explícita antes de alterar domínio, rota pública, segredo ou
  serviço com possível cobrança.

Até esse corte, o GAS/Sheets e o Portal público existentes não devem ser
substituídos automaticamente pela nova plataforma.

## Variáveis

- valores públicos do navegador usam o prefixo `VITE_`;
- segredos nunca recebem o prefixo `VITE_`;
- a chave privilegiada do Supabase não é necessária no navegador;
- `.env`, `.env.local` e `.dev.vars` não entram no Git;
- a inicialização falha quando uma variável obrigatória está ausente;
- `VITE_PORTAL_GIRO_ENV` identifica o ambiente e deve ser usado nos registros de
  auditoria e na identificação visual da aplicação.

### Prévia administrativa

- `VITE_SUPABASE_URL`: endereço público da API do Supabase do ambiente;
- `VITE_SUPABASE_PUBLISHABLE_KEY`: chave pública de cliente protegida por Auth e
  RLS;
- `VITE_PORTAL_GIRO_ENV`: identificação pública do ambiente;
- `VITE_APP_VERSION`: versão pública exibida e registrada na auditoria.

Nunca configurar `service_role`, chave secreta ou senha do banco com prefixo
`VITE_`, pois esse prefixo inclui o valor no JavaScript enviado ao navegador.

## Limite conhecido do plano gratuito

O advisor de segurança do Supabase pode apontar `Leaked Password Protection
Disabled`. A proteção que consulta senhas conhecidas como vazadas no
HaveIBeenPwned é disponibilizada pelo Supabase nos planos Pro e superiores. Ela
não será ativada apenas para eliminar o aviso enquanto a plataforma estiver sob
a restrição de não contratar serviços pagos.

Esse aviso não deve ser tratado por SQL nem removido artificialmente. Durante a
fase atual, o cadastro administrativo permanece controlado, o cadastro público
de usuários administrativos fica desativado e a autorização continua protegida
por Auth, RBAC e RLS. A decisão deve ser reavaliada antes da entrada em produção
caso o plano da infraestrutura mude.
