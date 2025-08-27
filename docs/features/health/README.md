# 🏥 Health Check API

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Sprint**: System Reliability  
**Completed**: 2025-08-27

## 🎯 Overview

O Health Check API fornece endpoints para verificar a saúde e disponibilidade da aplicação Mercurio API. Essencial para monitoramento, load balancers, e orchestração de containers, oferece verificações granulares dos componentes críticos do sistema.

### 🚀 Principais Benefícios

- **📊 Health Checks Inteligentes**: Verificação de database, memória e sistema
- **⚡ Response Rápido**: < 100ms para checks básicos
- **🔍 Detalhamento Granular**: Status por componente individual
- **🚨 Alertas Automáticos**: Detecção proativa de degradação
- **🐳 Container-Ready**: Integração nativa com Docker health checks

---

## 📋 Endpoints Disponíveis

### 1. 🩺 Basic Health Check
**GET** `/health`

Verificação básica e rápida da saúde da aplicação.

**Response**:
```json
{
  "status": "healthy",
  "service": "mercurio-api",
  "timestamp": "2025-08-27T14:30:15.123Z",
  "uptime": 3600
}
```

**Campos**:
- `status`: Status geral - `healthy` | `degraded` | `unhealthy`
- `service`: Nome do serviço
- `timestamp`: Timestamp da verificação em ISO8601
- `uptime`: Tempo de execução em segundos

**Status Codes**:
- `200`: Aplicação saudável
- `503`: Aplicação com problemas (degraded/unhealthy)

---

## 🔧 Configuração e Setup

### Pré-requisitos
- ✅ PostgreSQL conectado e acessível
- ✅ Memória suficiente disponível (< 80% de uso)

### Variáveis de Ambiente
```bash
# Database (obrigatórias)
DATABASE_URL=postgresql://user:password@localhost:5432/mercurio

# Health thresholds (opcionais)
HEALTH_DB_TIMEOUT_MS=5000           # Timeout para check de DB
HEALTH_MEMORY_WARNING_MB=512        # Warning de memória RAM
HEALTH_MEMORY_CRITICAL_MB=1024      # Critical de memória RAM
```

### Docker Health Check
```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Kubernetes Probes
```yaml
# deployment.yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## 💡 Exemplos de Uso

### 1. Verificação Manual
```bash
# Health check básico
curl -X GET "http://localhost:3000/health"

# Com timeout
curl --max-time 5 -X GET "http://localhost:3000/health"
```

### 2. Script de Monitoramento
```bash
#!/bin/bash
# health-monitor.sh

ENDPOINT="http://localhost:3000/health"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
  if curl -f --max-time 10 "$ENDPOINT" > /dev/null 2>&1; then
    echo "✅ API is healthy"
    exit 0
  else
    echo "❌ Attempt $i failed, retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo "🚨 API is unhealthy after $MAX_RETRIES attempts"
exit 1
```

### 3. Load Balancer Configuration
```nginx
# nginx.conf
upstream mercurio_api {
    server api1:3000;
    server api2:3000;
}

# Health check configuration
location /health {
    access_log off;
    proxy_pass http://mercurio_api;
    proxy_set_header Host $host;
}
```

---

## 🔍 Monitoramento e Alertas

### Métricas Importantes
- **Response Time**: < 100ms esperado
- **Availability**: > 99.9% uptime
- **Error Rate**: < 0.1% de falhas

### Alerting Rules (Prometheus)
```yaml
# alerts.yml
groups:
- name: mercurio-health
  rules:
  - alert: MercurioAPIDown
    expr: up{job="mercurio-api"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Mercurio API is down"

  - alert: MercurioAPIHighLatency
    expr: http_request_duration_seconds{endpoint="/health"} > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Mercurio API health check is slow"
```

---

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. Database Connection Failed
**Sintomas**: Health check retorna erro de database
**Diagnóstico**:
```bash
# Testar conexão direta
psql $DATABASE_URL -c "SELECT 1;"
```
**Soluções**:
1. Verificar se PostgreSQL está rodando
2. Confirmar string de conexão DATABASE_URL
3. Validar permissões de rede/firewall

#### 2. High Memory Usage
**Sintomas**: Warning de uso de memória > 80%
**Diagnóstico**:
```bash
# Verificar uso de memória
curl "http://localhost:3000/monitoring/performance" | jq '.metrics.system'
```
**Soluções**:
1. Reiniciar a aplicação se uso > 90%
2. Investigar memory leaks
3. Aumentar recursos disponíveis

#### 3. Health Check Timeout
**Sintomas**: Health check não responde em tempo
**Diagnóstico**:
```bash
# Testar com timeout específico
curl --max-time 5 "http://localhost:3000/health"
```
**Soluções**:
1. Verificar carga da aplicação
2. Analisar locks de database
3. Investigar processos bloqueantes

---

## 📊 Status de Saúde

### Critérios de Health Status

#### ✅ Healthy
- Database responde em < 1000ms
- Uso de memória < 80%
- Todos os sistemas funcionando normalmente

#### ⚠️ Degraded
- Database responde entre 1000-5000ms
- Uso de memória entre 80-95%
- Sistema funcionando com performance reduzida

#### 🚨 Unhealthy
- Database não responde ou > 5000ms
- Uso de memória > 95%
- Sistema com falhas críticas

---

## 📚 Recursos Adicionais

### Links Úteis
- **Monitoring API**: [Monitoring endpoints](/docs/features/monitoring/README.md)
- **Performance Metrics**: `/monitoring/performance`
- **Prometheus Metrics**: `/monitoring/metrics/prometheus`

### Scripts de Desenvolvimento
```bash
# Testar health check
curl -v http://localhost:3000/health

# Monitorar continuamente
watch -n 5 'curl -s http://localhost:3000/health | jq'

# Load test health endpoint
ab -n 1000 -c 10 http://localhost:3000/health
```

---

**🏥 Health Check API - Versão 1.0.0**  
*Implementado com ❤️ pelo time Mercurio*