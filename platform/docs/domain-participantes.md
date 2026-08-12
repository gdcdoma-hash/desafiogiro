# Domínio Participantes — ciclo 1

## Decisão de identificação

Cada participante recebe um `id` interno UUID, aleatório e permanente. O
identificador legado `ID_DGMB` continua opcionalmente armazenado para migração,
rastreabilidade e compatibilidade, mas não é a chave primária da nova
plataforma.

CPF não é usado como identificador técnico. Este ciclo não introduz
armazenamento de CPF na tabela principal de participantes.

## Entidade `participants`

Campos iniciais:

- `id`: UUID interno;
- `legacy_id_dgmb`: identificador do sistema anterior, único quando presente;
- `full_name`: nome do participante;
- `phone_e164`: telefone normalizado quando disponível;
- `city`: cidade;
- `state_code`: UF com duas letras;
- `status`: `ACTIVE`, `INACTIVE` ou `MERGED`;
- `notes`: observação administrativa curta, sem dados sensíveis;
- timestamps de criação e atualização.

## Regras

1. `legacy_id_dgmb` nunca substitui o UUID interno.
2. O mesmo `legacy_id_dgmb` não pode pertencer a duas pessoas.
3. Telefone não é chave primária e pode mudar.
4. Nome não é usado para deduplicação automática.
5. Participantes não são apagados destrutivamente quando já fizerem parte de
   outros domínios; serão inativados ou consolidados em ciclo específico.
6. Nenhuma regra de inscrição é acoplada nesta tabela.
7. Dados documentais sensíveis, se forem necessários mais adiante, terão
   estrutura e proteção próprias.

## Permissões

- `participants.read`: consultar participantes;
- `participants.manage`: criar e atualizar participantes.

O papel `platform_admin` recebe ambas neste ciclo.

## Fora deste ciclo

- CPF e outros documentos;
- autenticação do participante;
- inscrições;
- endereço completo;
- contatos de emergência;
- preferências de camisa;
- atividades e ranking;
- migração efetiva da base histórica.

Esses itens terão regras próprias antes de serem incorporados.
