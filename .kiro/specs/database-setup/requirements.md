# Requirements Document

## Introduction

Esta feature estabelece a fundação do banco de dados do Mercurio, incluindo guidelines para migrações, convenções de nomenclatura, e a criação das tabelas iniciais necessárias para suportar o sistema multi-tenant de analytics de funil. O objetivo é criar uma base sólida e escalável que suporte todas as funcionalidades do produto V1.

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor, eu quero ter guidelines claras para migrações de banco de dados, para que possamos manter consistência e rastreabilidade das mudanças no schema.

#### Acceptance Criteria

1. WHEN um desenvolvedor precisa criar uma migração THEN o sistema SHALL fornecer convenções claras de nomenclatura com timestamp e descrição
2. WHEN uma migração é criada THEN ela SHALL seguir o padrão `YYYYMMDD_HHMMSS_descricao_da_mudanca.sql`
3. WHEN migrações são executadas THEN elas SHALL ser aplicadas em ordem cronológica baseada no timestamp
4. WHEN uma migração falha THEN o sistema SHALL fornecer rollback automático quando possível
5. WHEN migrações são versionadas THEN elas SHALL incluir comentários explicando o propósito da mudança

### Requirement 2

**User Story:** Como desenvolvedor, eu quero usar IDs compactos e eficientes, para que o sistema tenha melhor performance e menor uso de storage.

#### Acceptance Criteria

1. WHEN uma tabela precisa de ID primário THEN ela SHALL usar BIGINT auto-increment ao invés de UUID
2. WHEN IDs precisam ser expostos externamente THEN eles SHALL usar prefixos identificadores (tn_, ws_, ld_, etc.)
3. WHEN referências entre tabelas são criadas THEN elas SHALL usar BIGINT para foreign keys
4. WHEN IDs são gerados THEN eles SHALL ser sequenciais e determinísticos para facilitar debugging
5. WHEN sistemas externos precisam referenciar recursos THEN eles SHALL usar os IDs prefixados

### Requirement 3

**User Story:** Como desenvolvedor, eu quero ter as tabelas fundamentais do sistema multi-tenant, para que possamos começar a implementar as funcionalidades core.

#### Acceptance Criteria

1. WHEN o sistema é inicializado THEN ele SHALL ter tabelas para tenant, workspace e api_key
2. WHEN dados são armazenados THEN todas as tabelas de domínio SHALL incluir tenant_id e workspace_id para isolamento
3. WHEN consultas são feitas THEN elas SHALL sempre filtrar por tenant_id e workspace_id
4. WHEN índices são criados THEN eles SHALL incluir tenant_id e workspace_id como primeiros campos
5. WHEN tabelas são criadas THEN elas SHALL seguir convenções de nomenclatura em snake_case

### Requirement 4

**User Story:** Como desenvolvedor, eu quero ter tabelas para o sistema de identidade, para que possamos rastrear visitantes anônimos e leads identificados.

#### Acceptance Criteria

1. WHEN um visitante acessa o site THEN o sistema SHALL poder armazenar dados do visitor com anonymous_id
2. WHEN um visitante se identifica THEN o sistema SHALL poder criar um lead e vincular ao anonymous_id
3. WHEN dados de identidade são armazenados THEN PII SHALL ser criptografada at-rest
4. WHEN matching de leads é necessário THEN o sistema SHALL usar fingerprints HMAC para comparação segura
5. WHEN vínculos são criados THEN a tabela identity_link SHALL conectar anonymous_id com lead_id

### Requirement 5

**User Story:** Como desenvolvedor, eu quero ter tabelas para armazenar eventos e sessões, para que possamos capturar a jornada completa do usuário.

#### Acceptance Criteria

1. WHEN eventos são recebidos THEN eles SHALL ser armazenados na tabela event com todos os campos necessários
2. WHEN sessões são criadas THEN elas SHALL ser rastreadas na tabela session com timestamps de início e fim
3. WHEN dados JSON são armazenados THEN eles SHALL usar JSONB para melhor performance de consulta
4. WHEN eventos são consultados THEN índices SHALL permitir busca eficiente por timestamp, tenant, e anonymous_id
5. WHEN dados são particionados THEN eles SHALL ser organizados por tenant_id e data para performance

### Requirement 6

**User Story:** Como desenvolvedor, eu quero ter tabelas para o sistema de funis, para que possamos implementar o builder visual e métricas.

#### Acceptance Criteria

1. WHEN funis são criados THEN eles SHALL ser armazenados com versionamento adequado
2. WHEN funis são publicados THEN snapshots imutáveis SHALL ser criados para consistência
3. WHEN steps de funil são definidos THEN eles SHALL suportar diferentes tipos (start, page, event, decision, conversion)
4. WHEN regras de matching são criadas THEN elas SHALL ser armazenadas como JSON flexível
5. WHEN publicações são feitas THEN elas SHALL incluir janela de tempo configurável