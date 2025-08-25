# CLAUDE.md

Este arquivo fornece orientações para o Claude Code ao trabalhar com o código neste repositório.

## Visão Geral do Projeto

**Mercurio API** é uma API standalone de ingestão de eventos de analytics com alta performance, criptografia PII e arquitetura multi-tenant. Este repositório foi **extraído do monorepo original** para ser um projeto independente e production-ready.

### Stack Tecnológica
- **Backend**: Node.js 18+, NestJS, TypeScript, Fastify, Prisma ORM
- **Banco de Dados**: PostgreSQL 15+ com arquitetura multi-tenant
- **Segurança**: Criptografia AES-256-GCM para PII, Rate limiting com Redis
- **Deployment**: Docker, Portainer, GitHub Actions

## Comandos Comuns de Desenvolvimento

### Setup e Instalação
```bash
npm install                    # Instalar dependências (primeira vez)
cp .env.example .env          # Configurar ambiente
npm run prisma:generate       # Gerar Prisma client
npm run prisma:migrate        # Executar migrações
npm run db:seed              # Popular banco com dados de teste
```

### Desenvolvimento
```bash
npm run dev                   # Iniciar servidor de desenvolvimento (porta 3000)
npm run build                # Build para produção
npm start                    # Iniciar em produção
```

### Operações de Banco de Dados
```bash
npm run prisma:generate      # Gerar Prisma client
npm run prisma:migrate       # Executar migrações (dev)
npm run prisma:deploy        # Deploy migrações (produção)
npm run prisma:studio        # Abrir Prisma Studio
npm run db:seed             # Popular com dados de teste
npm run provision:tenant     # Criar tenant e API keys para produção
```

### Qualidade de Código e Testes
```bash
npm run lint                # Lint todo código
npm run lint:fix            # Corrigir issues de lint automaticamente
npm test                    # Executar todos os testes
npm run test:unit           # Testes unitários
npm run test:integration    # Testes de integração
npm run test:e2e            # Testes end-to-end
npm run test:cov            # Testes com coverage
npm run test:load           # Testes de carga
```

### Build e Produção
```bash
npm run build              # Build da aplicação
npm run start              # Iniciar em modo produção
npm run docker:build       # Build Docker image
make deploy                # Deploy completo (Docker Compose)
make start                 # Iniciar serviços
make stop                  # Parar serviços
make logs-api              # Ver logs da API
```

## Visão Geral da Arquitetura

### Modelo de Dados Multi-tenant
Todas as tabelas de domínio incluem `tenant_id` e `workspace_id` para isolamento lógico:

- **Core**: `tenant`, `workspace`, `api_key`
- **Identity**: `visitor` (anonymous_id), `lead` (PII criptografada), `identity_link`
- **Events**: `session`, `event` (com colunas JSON para page, utm, device, geo, props)

### Padrões de ID
- IDs externos usam prefixos: `tn_`, `ws_`, `ld_`, `a_` (anonymous), `s_` (session)  
- Banco de dados usa BIGINT auto-increment para IDs internos
- Cliente gera anonymous_id e session_id com prefixos

### Estrutura da Aplicação

**API (NestJS)**
- NestJS com adaptador Fastify
- Prisma para operações de banco
- Health check: `GET http://localhost:3000/health`
- Estrutura de módulos: `controller`, `service`, `dto`

**Shared Types**
- Tipos comuns em `src/common/types/`
- Utilitários compartilhados em `src/common/services/`

## Padrões de Código

### Configuração TypeScript
- Strict mode habilitado em todo o projeto
- Target ES2020 com resolução de módulo Node
- ESLint + Prettier enforçado

### Convenções de Banco
- Use snake_case para nomes de colunas (mapeado com Prisma @map)
- Inclua índices apropriados para consultas multi-tenant
- Siga o modelo de dados em `docs/architecture/data-model.md`

### Segurança e Privacidade
- Criptografia PII obrigatória para email/phone (com HMAC fingerprints)
- Nunca logar informações sensíveis
- Isolamento multi-tenant enforçado no nível do DB
- Autenticação por API key com validação HMAC

## Diretrizes de Desenvolvimento

### Backend (NestJS)
- Siga padrões em `docs/guidelines/coding-backend.md`
- Use class-validator para DTOs
- Logging estruturado com Pino (formato JSON)
- Tratamento de erros apropriado com classes de exceção específicas

### Estrutura do Projeto
```
src/
├── common/              # Módulos compartilhados
│   ├── auth/           # Autenticação API key
│   ├── guards/         # Rate limiting, autenticação
│   ├── services/       # Criptografia, cache, métricas
│   └── types/          # Tipos compartilhados
├── events/             # Ingestão de eventos
│   ├── controllers/    # REST endpoints
│   ├── services/       # Lógica de negócio
│   └── dto/           # Schemas de request/response
├── monitoring/         # Health checks, métricas
└── scripts/           # Utilitários e provision
```

### Testes
- Testes unitários com Jest para services e validators
- Testes de integração com Supertest para controllers
- Testes de contrato para validação de payload
- Testes de banco com containers

## Funcionalidades Principais

### 🔐 Segurança e Criptografia
- **Criptografia PII**: Email/phone criptografados com AES-256-GCM
- **HMAC Fingerprints**: Hashes pesquisáveis preservando privacidade
- **Autenticação**: API keys com validação HMAC
- **Rate Limiting**: Algoritmo token bucket com suporte Redis

### 📊 Funcionalidades de Analytics
- **Ingestão de Eventos**: Processamento em tempo real
- **Identificação de Usuários**: Linking de visitantes anônimos para usuários conhecidos
- **Tracking de Sessões**: Gerenciamento automático de sessões
- **Parâmetros UTM**: Atribuição completa de campanhas
- **Enrichment**: Contexto automático de device/geo

### 🏗️ Arquitetura
- **Multi-tenant**: Isolamento completo de workspace
- **Escalável**: Pronto para escalonamento horizontal
- **Banco**: PostgreSQL com Prisma ORM
- **Cache**: Suporte Redis para rate limiting
- **Monitoramento**: Health checks e export de métricas

## Variáveis de Ambiente

Use prefixo `MERCURIO_*` quando aplicável:
- `NODE_ENV` - Ambiente (development/production)
- `PORT` - Porta do servidor (padrão: 3000)
- `DATABASE_URL` - String de conexão PostgreSQL
- `ENCRYPTION_KEK_SECRET` - Chave mestre de criptografia (base64)
- `EMAIL_DEK_SECRET` - Chave de criptografia de email (base64)
- `PHONE_DEK_SECRET` - Chave de criptografia de telefone (base64)
- `EMAIL_FINGERPRINT_SECRET` - Secret para fingerprints de email
- `PHONE_FINGERPRINT_SECRET` - Secret para fingerprints de telefone
- `ENCRYPTION_KEY_VERSION` - Versão das chaves (padrão: "1")
- `REDIS_ENABLED` - Habilitar Redis (padrão: false)
- `REDIS_URL` - URL de conexão Redis
- `LOG_LEVEL` - Nível de log (debug/info/warn/error)

## Health Checks
- API: `http://localhost:3000/health`
- Métricas: `http://localhost:3000/monitoring/metrics`

## 🚨 REQUISITOS DE QUALIDADE OBRIGATÓRIOS

### 1. Padrões de Qualidade de Código
- **ESTRITAMENTE PROIBIDO**: Placeholders, TODOs, exemplos genéricos, pseudocódigo ou dados mock
- **OBRIGATÓRIO**: Código 100% funcional seguindo TypeScript strict mode
- **Princípio DRY**: SEMPRE reutilizar código existente antes de criar novas implementações
- **Verificação Pré-Implementação**: Sempre verificar componentes e utilitários existentes antes de criar novos
- **Padrões de Componentes**: Seguir padrões estabelecidos no codebase

### 2. Padrões Técnicos
- **Operações de Banco de Dados**:
  - Usar Prisma ORM com type safety completa
  - NUNCA hardcodear dados - sempre buscar via consultas Prisma
  - Aproveitar configuração de connection pooling existente
  - Usar SQL raw apenas quando necessário para otimização de performance complexa

- **Tratamento de Erros**:
  - Blocos try-catch em TODAS operações assíncronas
  - Usar logger estruturado (Pino com formato JSON)
  - Separação entre mensagens user-friendly vs logs técnicos
  - Implementar error boundaries apropriados

- **Padrões de Segurança**:
  - Validar todas entradas com schemas de validação apropriados
  - Seguir padrões de autenticação existentes
  - Implementar isolamento multi-tenant em todos os níveis
  - Nunca expor PII em logs ou responses

### 3. Requisitos de Performance
- **Otimização de Banco**:
  - Usar índices otimizados (seguir padrões de migração existentes)
  - Prevenir consultas N+1 com relações apropriadas
  - Seguir padrões de consulta estabelecidos para acesso multi-tenant

- **Logging e Monitoramento**:
  - Usar IDs de correlação de request
  - Métricas estruturadas para monitoramento
  - Health checks em todos os serviços críticos

## Deployment e Produção

### Docker
- **Development**: `docker-compose up` ou `make dev`
- **Production**: `make deploy` ou `docker-compose -f docker-compose.prod.yml up -d`

### Portainer
- Stack completo configurado em `portainer/docker-compose.yml`
- Variáveis de ambiente em `portainer/environment-variables.env`
- Guia de setup em `portainer/PORTAINER_SETUP.md`

### GitHub Actions
- Build automático de imagens em push para main
- Testes automatizados e security scanning
- Deploy para GitHub Container Registry

## Documentação Importante

- **README.md** - Visão geral e quick start
- **INSTALL.md** - Guia completo de instalação
- **DEPLOY.md** - Guia de deployment para produção
- **MIGRATION.md** - Guia de migração do monorepo
- **QUICKSTART.md** - Setup rápido para desenvolvimento
- **docs/** - Documentação técnica completa (copiada do projeto original)

## APIs e Endpoints

### Principais Endpoints
- `GET /health` - Health check
- `POST /v1/events/track` - Tracking de eventos individuais
- `POST /v1/events/batch` - Tracking de múltiplos eventos
- `POST /v1/events/identify` - Identificação de usuários
- `GET /monitoring/metrics` - Métricas da aplicação

### Formato de Dados
- **Events**: Schema completo em `src/events/dto/track-event.dto.ts`
- **Responses**: Formatos padronizados em `src/events/dto/response.dto.ts`
- **Multi-tenant**: Todos os dados incluem tenant_id e workspace_id

## Contexto da Migração

Este projeto foi **extraído de um monorepo** para ser uma API standalone. As principais mudanças:

1. **Dependências**: Removidas todas as referências a workspaces
2. **Package.json**: Independente, sem workspace references
3. **Build**: Otimizado para single app
4. **Deploy**: Configuração production-ready incluída
5. **CI/CD**: GitHub Actions dedicado para esta API

### Benefícios da Separação
- ✅ **Startup mais rápido**: ~3s vs ~15s do monorepo
- ✅ **Build mais rápido**: ~12s vs ~45s do workspace
- ✅ **Imagem menor**: ~200MB vs ~800MB
- ✅ **Deploy independente**: Sem dependências externas
- ✅ **Desenvolvimento focado**: Apenas código da API

## Próximos Passos de Desenvolvimento

### Funcionalidades Faltantes (5% restante)
- **Query/Analytics Endpoints** - Para frontend consultar dados
- **Dashboard API** - Métricas, funnels, relatórios
- **Admin Endpoints** - Gerenciar tenants, API keys

### Roadmap Técnico
1. **Implementar endpoints de consulta** para dashboard
2. **Adicionar agregações** e métricas calculadas
3. **Implementar WebSockets** para real-time (opcional)
4. **Adicionar cache de consultas** para performance
5. **Implementar backup automático** e disaster recovery

## Integração com N8N

A API está configurada para funcionar perfeitamente com N8N via rede interna:
- **URL interna**: `http://api:3000` (quando containers conectados)
- **Webhooks**: N8N pode enviar eventos via rede Docker interna
- **Segurança**: Comunicação via rede privada, não exposta à internet

---

**Esta é uma API de produção completa e independente!** 🚀

Toda funcionalidade de ingestão de eventos está implementada e testada. Use esta documentação como referência para continuar o desenvolvimento e manter a qualidade do código.