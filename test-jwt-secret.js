const jwt = require('jsonwebtoken');

// Token que está falhando 
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZXF3dmN0b3VkcXJjdHFsemJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzUzMTQsImV4cCI6MjA3MTgxMTMxNH0.zGBecypLlXlKB9sNdEcFQ7CIpj9A6Nvo2dav_O-JmdQ';

console.log('🔍 Testing JWT Secret');
console.log('=====================');

// Este É O JWT SECRET (anon key)  
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZXF3dmN0b3VkcXJjdHFsemJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzUzMTQsImV4cCI6MjA3MTgxMTMxNH0.zGBecypLlXlKB9sNdEcFQ7CIpj9A6Nvo2dav_O-JmdQ';

console.log('🔍 O token É O JWT SECRET!');
console.log('Token === Anon Key:', token === anonKey);

if (token === anonKey) {
  console.log('\n❌ PROBLEMA: O token que recebemos É o próprio JWT Secret!');
  console.log('Isso significa que estamos recebendo o anon key, não um user token.');
  console.log('\n💡 SOLUÇÃO: O frontend precisa enviar o USER ACCESS TOKEN, não o anon key!');
} else {
  // Se fossem diferentes, testaríamos a validação
  try {
    const verified = jwt.verify(token, anonKey, {
      algorithms: ['HS256'],
      issuer: 'supabase'
    });
    console.log('✅ Validação: SUCESSO');
    console.log('User:', verified);
  } catch (error) {
    console.log('❌ Validação: FALHOU');
    console.log('Erro:', error.message);
  }
}