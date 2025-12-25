
const fs = require('fs');

console.log('Fixing env.js for TUSUR deployment...');

const envFile = '/opt/outline/build/server/env.js';

if (!fs.existsSync(envFile)) {
  console.error('env.js not found:', envFile);
  process.exit(1);
}

let code = fs.readFileSync(envFile, 'utf8');

// Устанавливаем isCloudHosted = true
code = code.replace(
  /isCloudHosted:\s*[^,}]+/,
  'isCloudHosted: true // TUSUR: Force cloud hosted mode to disable origin checks'
);

// Устанавливаем URL из environment
code = code.replace(
  /URL:\s*"[^"]*"/,
  'URL: process.env.URL || "https://outline-docs.tusur.ru"'
);

// Добавляем debug logging
if (!code.includes('// TUSUR DEBUG')) {
  code = code.replace(
    /const env = {/,
    `// TUSUR DEBUG: Enhanced logging
console.log('[TUSUR ENV] Loading environment configuration');
console.log('[TUSUR ENV] URL:', process.env.URL);
console.log('[TUSUR ENV] CORS_ORIGIN:', process.env.CORS_ORIGIN);
console.log('[TUSUR ENV] ALLOWED_DOMAINS:', process.env.ALLOWED_DOMAINS);

const env = {`
  );
}

fs.writeFileSync(envFile, code);
console.log('env.js fixed for TUSUR');