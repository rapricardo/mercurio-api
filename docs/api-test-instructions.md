
  🔑 API Key para Testes:

  mk_test_801e40d655d6682518965a6913076bd997643ab231f0505b54c16f78b8a7433c

  📡 Endpoints Disponíveis:

  - Base URL: http://localhost:3000
  - Track Event: POST /v1/events/track
  - Batch Events: POST /v1/events/batch
  - Identify User: POST /v1/events/identify

  🚀 Teste Rápido via cURL:

  curl -X POST http://localhost:3000/v1/events/track \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer 
  mk_test_801e40d655d6682518965a6913076bd997643ab231f0505b54c16f78b8a7433c" \
    -d '{
      "event_name": "page_view",
      "timestamp": "2025-08-25T12:56:55.352Z",
      "anonymous_id": "a_test_user_001",
      "properties": {
        "page": "dashboard",
        "source": "test"
      }
    }'

  📋 Formatos de Payload:

  1. Track Event (Evento Básico):

  {
    "event_name": "page_view",
    "timestamp": "2025-08-25T12:56:55.352Z",
    "anonymous_id": "a_user_123",
    "properties": {
      "page": "dashboard"
    }
  }

  2. Identify User (Com PII Criptografado):

  {
    "anonymous_id": "a_user_123",
    "user_id": "usr_12345",
    "traits": {
      "email": "usuario@teste.com",
      "name": "João Silva"
    }
  }

  ⚠️ Regras Importantes:

  - anonymous_id deve começar com "a_"
  - session_id deve começar com "s_" (opcional)
  - timestamp deve ser ISO 8601
  - Email/telefone são criptografados automaticamente
  - Rate limit: 1000 requests/minuto (tier free)

  Agora é só subir a API (npm run dev) e começar a testar! 🎯