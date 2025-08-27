#!/bin/bash

# 🔑 Mercurio API - Gerador de Chaves de Segurança
# Este script gera automaticamente todas as chaves necessárias para o Mercurio API

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}🔑 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}💡 $1${NC}"
}

print_header "MERCURIO API - GERADOR DE CHAVES DE SEGURANÇA"
echo ""

# Verificar se openssl está disponível
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL não encontrado. Instale o OpenSSL para continuar."
    exit 1
fi

echo "🔐 Gerando chaves de criptografia..."
echo ""

# Gerar todas as chaves
ENCRYPTION_KEK_SECRET=$(openssl rand -base64 32)
EMAIL_DEK_SECRET=$(openssl rand -base64 32)
PHONE_DEK_SECRET=$(openssl rand -base64 32)
EMAIL_FINGERPRINT_SECRET=$(openssl rand -hex 32)
PHONE_FINGERPRINT_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -base64 32)
MERCURIO_REDIS_PASSWORD=$(openssl rand -base64 16)

# Criar arquivo .env
print_info "Criando arquivo .env com as chaves geradas..."

cat > .env << EOF
# =============================================================================
# 🚀 MERCURIO API - PORTAINER ENVIRONMENT VARIABLES
# =============================================================================
# Arquivo gerado automaticamente em $(date)

# =============================================================================
# 🔐 REDIS CONFIGURATION
# =============================================================================
MERCURIO_REDIS_PASSWORD=${MERCURIO_REDIS_PASSWORD}

# =============================================================================
# 🗄️ SUPABASE DATABASE CONFIGURATION
# =============================================================================
# ⚠️  PREENCHA MANUALMENTE com seus dados do Supabase:
# URL com parâmetros otimizados para pgBouncer/Transaction Pooler
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# =============================================================================
# 🔐 ENCRYPTION & SECURITY (GERADAS AUTOMATICAMENTE)
# =============================================================================
ENCRYPTION_KEK_SECRET=${ENCRYPTION_KEK_SECRET}
EMAIL_DEK_SECRET=${EMAIL_DEK_SECRET}
PHONE_DEK_SECRET=${PHONE_DEK_SECRET}
EMAIL_FINGERPRINT_SECRET=${EMAIL_FINGERPRINT_SECRET}
PHONE_FINGERPRINT_SECRET=${PHONE_FINGERPRINT_SECRET}

# =============================================================================
# 🔑 JWT CONFIGURATION
# =============================================================================
JWT_SECRET=${JWT_SECRET}

# =============================================================================
# 🌐 CORS & NETWORK SETTINGS
# =============================================================================
CORS_ORIGIN=https://n8n.ricardotocha.com.br,https://evolution.ricardotocha.com.br,https://apollo.ricardotocha.com.br

# =============================================================================
# 📊 OPTIONAL SETTINGS
# =============================================================================
LOG_LEVEL=INFO
RATE_LIMIT_MAX_REQUESTS=1000
DEFAULT_DATA_RETENTION_DAYS=90
EOF

print_success "Arquivo .env criado com chaves geradas!"
echo ""

print_header "📋 RESUMO DAS CHAVES GERADAS"
echo ""
echo "🔐 ENCRYPTION_KEK_SECRET: ${ENCRYPTION_KEK_SECRET:0:20}..."
echo "📧 EMAIL_DEK_SECRET: ${EMAIL_DEK_SECRET:0:20}..."
echo "📱 PHONE_DEK_SECRET: ${PHONE_DEK_SECRET:0:20}..."
echo "🔍 EMAIL_FINGERPRINT_SECRET: ${EMAIL_FINGERPRINT_SECRET:0:20}..."
echo "🔍 PHONE_FINGERPRINT_SECRET: ${PHONE_FINGERPRINT_SECRET:0:20}..."
echo "🎫 JWT_SECRET: ${JWT_SECRET:0:20}..."
echo "🗂️ REDIS_PASSWORD: ${MERCURIO_REDIS_PASSWORD:0:10}..."
echo ""

print_header "⚠️  PRÓXIMOS PASSOS OBRIGATÓRIOS"
echo ""
print_info "1. Edite o arquivo .env e configure suas credenciais do Supabase:"
print_info "   - SUPABASE_DATABASE_URL"
print_info "   - SUPABASE_URL"
print_info "   - SUPABASE_SERVICE_ROLE_KEY"
print_info "   - SUPABASE_ANON_KEY"
echo ""
print_info "2. No Portainer:"
print_info "   - Crie um stack chamado 'mercurio-api'"
print_info "   - Cole o conteúdo do docker-compose.yml"
print_info "   - Adicione as variáveis do arquivo .env"
print_info "   - Deploy o stack!"
echo ""
print_success "Todas as chaves foram geradas com segurança! 🚀"