const https = require('https');

/**
 * Test script for the new onboarding endpoint
 * This bypasses workspace access checks for first-time users
 */

async function testOnboarding() {
  console.log('🧪 Testing Onboarding Endpoint');
  
  // Get token from Supabase (using anon key for development)
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZXF3dmN0b3VkcXJjdHFsemJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxODk2OTIsImV4cCI6MjA0ODc2NTY5Mn0.9lIabjayJPgVAOI2gYmWHk0YW9F97CXW2hJoLMkU24k';
  
  const postData = JSON.stringify({
    tenantName: "Mercurio Test Corp",
    workspaceName: "Test Workspace",
    tenantDescription: "Test tenant for onboarding flow",
    workspaceDescription: "Development workspace",
    workspaceEnvironment: "development"
  });

  const options = {
    hostname: 'mercurio-api.ricardotocha.com.br',
    port: 443,
    path: '/v1/onboarding',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('📊 Response Status:', res.statusCode);
        console.log('📋 Response Headers:', JSON.stringify(res.headers, null, 2));
        
        try {
          const response = JSON.parse(data);
          console.log('✅ Response Body:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          console.log('📝 Raw Response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      reject(error);
    });

    // Write data to request body
    req.write(postData);
    req.end();
  });
}

// Run test
testOnboarding()
  .then((response) => {
    console.log('🎉 Test completed successfully!');
    if (response.tenant && response.workspace) {
      console.log(`✨ Created tenant: ${response.tenant.name} (ID: ${response.tenant.id})`);
      console.log(`✨ Created workspace: ${response.workspace.name} (ID: ${response.workspace.id})`);
      console.log(`✨ Granted access: ${response.userAccess.role} role`);
    }
  })
  .catch((error) => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });