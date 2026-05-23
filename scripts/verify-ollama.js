/**
 * scripts/verify-ollama.js
 * Simple Node.js verification for Ollama connection
 * Usage: node scripts/verify-ollama.js
 */

const http = require('http');

console.log('=== VellonCVs - Ollama Verification (Node.js) ===\n');

const options = {
  hostname: 'localhost',
  port: 11434,
  path: '/api/tags',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('✓ Ollama API is responsive');
        
        if (json.models && json.models.length > 0) {
          console.log('✓ Models found:');
          json.models.forEach(m => {
            console.log(`   - ${m.name}`);
          });
        } else {
          console.log('⚠ No models installed. Run: ollama pull llama3.1:8b');
        }
        
        console.log('\n✓ Connection to Ollama established successfully.');
      } catch (e) {
        console.error('✗ Failed to parse response:', e.message);
      }
    } else {
      console.error(`✗ Received status code ${res.statusCode}`);
    }
  });
});

req.on('error', (e) => {
  console.error('✗ Connection failed:', e.message);
  console.error('\nPlease make sure Ollama is running:');
  console.error('  ollama serve');
});

req.on('timeout', () => {
  console.error('✗ Request timed out. Is Ollama running?');
  req.destroy();
});

req.end();
