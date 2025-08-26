# Requirements Document

## Introduction

O JavaScript SDK é o ponto de entrada principal para desenvolvedores integrarem com o Mercurio. O objetivo é transformar a integração complexa de event tracking em algo simples e intuitivo, oferecendo uma API limpa que funciona tanto para tracking manual quanto automático. O SDK deve ser leve, performático e oferecer uma excelente experiência para desenvolvedores, competindo diretamente com soluções como Google Analytics, Mixpanel e Segment.

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor, eu quero inicializar o SDK com uma única linha de código, para que eu possa começar a fazer tracking de eventos imediatamente sem configuração complexa.

#### Acceptance Criteria

1. WHEN o desenvolvedor chama `mercurio.init('ak_api_key')` THEN o sistema SHALL inicializar automaticamente o visitor ID, session management e começar o tracking de page views
2. WHEN o SDK é inicializado THEN o sistema SHALL gerar ou carregar um visitor ID persistente do localStorage
3. WHEN o SDK é inicializado THEN o sistema SHALL automaticamente fazer tracking do primeiro page view
4. WHEN o SDK é inicializado sem API key válida THEN o sistema SHALL mostrar um erro claro no console em modo development

### Requirement 2

**User Story:** Como desenvolvedor, eu quero fazer tracking de eventos customizados com uma API simples, para que eu possa capturar interações específicas do usuário na minha aplicação.

#### Acceptance Criteria

1. WHEN o desenvolvedor chama `mercurio.track('event_name', properties)` THEN o sistema SHALL enviar o evento para a API com timestamp, visitor ID e session ID automaticamente
2. WHEN propriedades são passadas no evento THEN o sistema SHALL incluir todas as propriedades no payload do evento
3. WHEN o evento é enviado THEN o sistema SHALL incluir automaticamente contexto da página (URL, title, referrer)
4. WHEN múltiplos eventos são enviados rapidamente THEN o sistema SHALL fazer batching inteligente para otimizar performance

### Requirement 3

**User Story:** Como desenvolvedor, eu quero identificar usuários e associar eventos a identidades específicas, para que eu possa fazer análises baseadas em usuários conhecidos.

#### Acceptance Criteria

1. WHEN o desenvolvedor chama `mercurio.identify('user_id', traits)` THEN o sistema SHALL associar o visitor ID atual com o user ID fornecido
2. WHEN um usuário é identificado THEN o sistema SHALL incluir o user ID em todos os eventos subsequentes
3. WHEN traits são fornecidos THEN o sistema SHALL armazenar os traits do usuário e incluí-los em eventos futuros
4. WHEN `mercurio.identify()` é chamado sem user ID THEN o sistema SHALL apenas atualizar os traits do usuário atual

### Requirement 4

**User Story:** Como desenvolvedor, eu quero que o SDK funcione offline e recupere eventos perdidos automaticamente, para que eu não perca dados mesmo com conectividade instável.

#### Acceptance Criteria

1. WHEN a rede está indisponível THEN o sistema SHALL armazenar eventos em uma queue local (localStorage/IndexedDB)
2. WHEN a conectividade é restaurada THEN o sistema SHALL automaticamente reenviar eventos da queue
3. WHEN eventos falham no envio THEN o sistema SHALL implementar retry com backoff exponencial
4. WHEN a queue local atinge o limite máximo THEN o sistema SHALL remover eventos mais antigos (FIFO)

### Requirement 5

**User Story:** Como desenvolvedor, eu quero tracking automático de page views e navegação, para que eu não precise instrumentar manualmente cada mudança de página.

#### Acceptance Criteria

1. WHEN uma nova página é carregada THEN o sistema SHALL automaticamente enviar um evento de page view
2. WHEN o usuário navega via History API (SPA) THEN o sistema SHALL detectar mudanças de URL e enviar page views
3. WHEN um page view é enviado THEN o sistema SHALL incluir URL, title, referrer e UTM parameters automaticamente
4. WHEN o desenvolvedor chama `mercurio.page()` manualmente THEN o sistema SHALL enviar um page view com dados atuais da página

### Requirement 6

**User Story:** Como desenvolvedor, eu quero capturar automaticamente UTM parameters e dados de campanha, para que eu possa analisar a efetividade das minhas campanhas de marketing.

#### Acceptance Criteria

1. WHEN a página é carregada com UTM parameters THEN o sistema SHALL extrair e armazenar utm_source, utm_medium, utm_campaign, utm_term, utm_content
2. WHEN UTM parameters são capturados THEN o sistema SHALL incluí-los em todos os eventos da sessão
3. WHEN novos UTM parameters são detectados THEN o sistema SHALL atualizar os dados de campanha da sessão atual
4. WHEN não há UTM parameters THEN o sistema SHALL manter os dados de campanha da sessão anterior se existirem

### Requirement 7

**User Story:** Como desenvolvedor, eu quero integração fácil com formulários para tracking automático de submissões, para que eu possa analisar conversões sem código adicional.

#### Acceptance Criteria

1. WHEN o desenvolvedor chama `mercurio.trackForm('#form-selector', 'event_name')` THEN o sistema SHALL automaticamente fazer tracking quando o formulário for submetido
2. WHEN um formulário é submetido THEN o sistema SHALL capturar dados dos campos (respeitando privacidade)
3. WHEN o tracking de formulário é configurado THEN o sistema SHALL incluir informações sobre validação e erros
4. WHEN múltiplos formulários são trackados THEN o sistema SHALL distinguir entre diferentes formulários

### Requirement 8

**User Story:** Como desenvolvedor, eu quero suporte nativo ao TypeScript e IntelliSense, para que eu tenha uma experiência de desenvolvimento superior com autocompletar e verificação de tipos.

#### Acceptance Criteria

1. WHEN o SDK é importado em um projeto TypeScript THEN o sistema SHALL fornecer tipos completos para todas as APIs
2. WHEN propriedades de evento são definidas THEN o sistema SHALL validar tipos em tempo de compilação
3. WHEN métodos do SDK são chamados THEN o IDE SHALL mostrar documentação inline e sugestões de parâmetros
4. WHEN tipos customizados são definidos THEN o sistema SHALL permitir extensão dos tipos base do SDK

### Requirement 9

**User Story:** Como desenvolvedor, eu quero um bundle otimizado e carregamento assíncrono, para que o SDK não impacte a performance da minha aplicação.

#### Acceptance Criteria

1. WHEN o SDK é incluído na página THEN o bundle core SHALL ser menor que 10kb gzipped
2. WHEN funcionalidades avançadas são usadas THEN o sistema SHALL carregar módulos adicionais sob demanda
3. WHEN o SDK é inicializado THEN o sistema SHALL não bloquear o carregamento da página
4. WHEN o SDK é carregado via CDN THEN o sistema SHALL usar cache agressivo e versionamento adequado

### Requirement 10

**User Story:** Como desenvolvedor, eu quero debugging e logs detalhados em modo de desenvolvimento, para que eu possa facilmente identificar e resolver problemas de integração.

#### Acceptance Criteria

1. WHEN o SDK está em modo debug THEN o sistema SHALL logar todas as operações no console
2. WHEN eventos são enviados THEN o sistema SHALL mostrar o payload completo em modo debug
3. WHEN erros ocorrem THEN o sistema SHALL fornecer mensagens de erro claras e acionáveis
4. WHEN o SDK está em produção THEN o sistema SHALL suprimir logs de debug automaticamente

### Requirement 11

**User Story:** Como desenvolvedor, eu quero integração simples com frameworks populares (React, Vue, Angular), para que eu possa usar o SDK de forma idiomática em qualquer stack tecnológico.

#### Acceptance Criteria

1. WHEN usado com React THEN o sistema SHALL fornecer hooks customizados como `useMercurio()`
2. WHEN usado com Vue THEN o sistema SHALL fornecer um plugin Vue com reatividade
3. WHEN usado com Angular THEN o sistema SHALL fornecer um service injetável
4. WHEN usado com vanilla JavaScript THEN o sistema SHALL funcionar sem dependências de framework

### Requirement 12

**User Story:** Como desenvolvedor, eu quero tracking de e-commerce com eventos padronizados, para que eu possa facilmente implementar análises de funil de vendas e revenue tracking.

#### Acceptance Criteria

1. WHEN produtos são visualizados THEN o sistema SHALL suportar evento `product_viewed` com propriedades padronizadas
2. WHEN itens são adicionados ao carrinho THEN o sistema SHALL suportar evento `add_to_cart` com valor e quantidade
3. WHEN compras são realizadas THEN o sistema SHALL suportar evento `purchase` com revenue, items e payment_method
4. WHEN eventos de e-commerce são enviados THEN o sistema SHALL validar propriedades obrigatórias e formatos

### Requirement 13

**User Story:** Como desenvolvedor, eu quero integração real-time com funis e métricas, para que eu possa oferecer experiências personalizadas baseadas no comportamento do usuário.

#### Acceptance Criteria

1. WHEN um usuário completa um step de funil THEN o sistema SHALL disparar callbacks real-time
2. WHEN métricas são solicitadas THEN o sistema SHALL retornar dados agregados em tempo real
3. WHEN eventos são enviados THEN o sistema SHALL permitir subscription para feedback imediato
4. WHEN funis são ativados THEN o sistema SHALL automaticamente trackear progressão nos steps
5. IF análises em tempo real são habilitadas THEN o sistema SHALL otimizar para baixa latência

### Requirement 14

**User Story:** Como desenvolvedor, eu quero controles avançados de privacidade e compliance, para que eu possa atender regulamentações LGPD/GDPR de forma granular.

#### Acceptance Criteria

1. WHEN GDPR mode é ativado THEN o sistema SHALL requerer consentimento explícito antes de qualquer tracking
2. WHEN consentimento é revogado THEN o sistema SHALL parar todo tracking e limpar dados locais
3. WHEN data minimization é habilitada THEN o sistema SHALL coletar apenas dados essenciais
4. WHEN usuário opta por DNT THEN o sistema SHALL respeitar a preferência automaticamente
5. IF consentimento não é dado THEN o sistema SHALL funcionar em modo analytics-free

### Requirement 15

**User Story:** Como desenvolvedor, eu quero performance monitoring integrado e Web Vitals, para que eu possa correlacionar performance do site com métricas de negócio.

#### Acceptance Criteria

1. WHEN performance tracking é habilitado THEN o sistema SHALL coletar Core Web Vitals automaticamente
2. WHEN custom metrics são definidas THEN o sistema SHALL permitir tracking de métricas específicas
3. WHEN performance degrada THEN o sistema SHALL correlacionar com eventos de abandono
4. WHEN vitals são coletadas THEN o sistema SHALL incluí-las em eventos de page view
5. IF thresholds são configurados THEN o sistema SHALL disparar alertas de performance

### Requirement 16

**User Story:** Como desenvolvedor, eu quero configurações avançadas de transporte e sampling, para que eu possa otimizar para diferentes cenários de tráfego e performance.

#### Acceptance Criteria

1. WHEN high-traffic é detectado THEN o sistema SHALL permitir sampling rate configurável
2. WHEN diferentes transport methods são necessários THEN o sistema SHALL suportar fetch, beacon e XHR
3. WHEN persistence é crítica THEN o sistema SHALL permitir escolha entre memory, local e session storage
4. WHEN bandwidth é limitado THEN o sistema SHALL priorizar eventos críticos
5. IF custom transport é necessário THEN o sistema SHALL permitir transport plugins customizados