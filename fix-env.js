const fs = require('fs');

const envFile = '/opt/outline/build/server/env.js';
console.log('Fixing env.js for TUSUR...');

if (!fs.existsSync(envFile)) {
  console.error('env.js not found');
  process.exit(1);
}

let code = fs.readFileSync(envFile, 'utf8');

// Устанавливаем isCloudHosted = true
code = code.replace(
  /isCloudHosted:\s*[^,}]+/,
  'isCloudHosted: true // TUSUR: Force cloud hosted mode'
);

// Также устанавливаем URL правильно
code = code.replace(
  /URL:\s*"[^"]*"/,
  'URL: process.env.URL || "https://outline-docs.tusur.ru"'
);

fs.writeFileSync(envFile, code);
console.log('env.js fixed for TUSUR');