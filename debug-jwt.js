const jwt = require('jsonwebtoken');

// Token do frontend (cole aqui o token que aparece no log)
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZXF3dmN0b3VkcXJjdHFsemJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzUzMTQsImV4cCI6MjA3MTgxMTMxNH0.zGBecypLlXlKB9sNdEcFQ7CIpj9A6Nvo2dav_O-JmdQ';

console.log('🔍 JWT Debug Script');
console.log('===================');

// Decode sem verificação para ver o conteúdo
const decoded = jwt.decode(token, { complete: true });
console.log('\n📋 JWT Header:');
console.log(JSON.stringify(decoded.header, null, 2));

console.log('\n📋 JWT Payload:');
console.log(JSON.stringify(decoded.payload, null, 2));

// Configurações esperadas
const expectedIssuer = 'https://rkeqwvctoudqrctqlzba.supabase.co';
const jwtSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZXF3dmN0b3VkcXJjdHFsemJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzUzMTQsImV4cCI6MjA3MTgxMTMxNH0.zGBecypLlXlKB9sNdEcFQ7CIpj9A6Nvo2dav_O-JmdQ';

console.log('\n🎯 Comparação:');
console.log('Expected Issuer:', expectedIssuer);
console.log('Actual Issuer:  ', decoded.payload.iss);
console.log('Match:          ', decoded.payload.iss === expectedIssuer ? '✅' : '❌');

// Tentar validar com issuer
try {
  console.log('\n🔐 Tentando validação com issuer...');
  const verified = jwt.verify(token, jwtSecret, {
    algorithms: ['HS256'],
    issuer: expectedIssuer
  });
  console.log('✅ Validação com issuer: SUCESSO');
} catch (error) {
  console.log('❌ Validação com issuer: FALHOU');
  console.log('Erro:', error.message);
}

// Tentar validar sem issuer
try {
  console.log('\n🔓 Tentando validação sem issuer...');
  const verified = jwt.verify(token, jwtSecret, {
    algorithms: ['HS256']
    // sem issuer
  });
  console.log('✅ Validação sem issuer: SUCESSO');
} catch (error) {
  console.log('❌ Validação sem issuer: FALHOU');
  console.log('Erro:', error.message);
}