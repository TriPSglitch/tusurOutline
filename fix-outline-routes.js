const fs = require('fs');
const path = require('path');

console.log('Simple fix for auth.js - adding GET endpoint...');

const authFile = '/opt/outline/build/server/routes/api/auth/auth.js';

if (!fs.existsSync(authFile)) {
  console.error('auth.js not found');
  process.exit(1);
}

// Создаем backup
fs.copyFileSync(authFile, authFile + '.backup-fix');

let content = fs.readFileSync(authFile, 'utf8');

// 1. Найдем POST "auth.config" и добавим GET версию ПРОСТЫМ способом
const postConfigLine = 'router.post("auth.config", async ctx => {';
const postConfigIndex = content.indexOf(postConfigLine);

if (postConfigIndex === -1) {
  console.error('POST auth.config not found');
  process.exit(1);
}

console.log('Found POST auth.config at line:', content.substring(0, postConfigIndex).split('\n').length);

// Найдем где заканчивается эта функция (ищем соответствующую закрывающую скобку)
let braceCount = 0;
let inFunction = false;
let functionEnd = -1;

for (let i = postConfigIndex; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    inFunction = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (inFunction && braceCount === 0) {
      functionEnd = i;
      break;
    }
  }
}

if (functionEnd === -1) {
  console.error('Could not find end of function');
  process.exit(1);
}

// 2. Извлечем тело функции (без router.post строки)
const functionStart = content.indexOf('{', postConfigIndex) + 1;
const functionBody = content.substring(functionStart, functionEnd);

// 3. Создаем GET версию
const getVersion = `
router.get("auth.config", async ctx => {
${functionBody}
});
`;

// 4. Вставим GET версию сразу после POST версии
content = content.slice(0, functionEnd + 1) + '\n\n' + getVersion + content.slice(functionEnd + 1);

// 5. Также добавим простой тестовый endpoint в КОНЕЦ файла (перед module.exports)
const exportIndex = content.lastIndexOf('module.exports');
if (exportIndex !== -1) {
  const testEndpoint = `

// Test endpoint
router.get('/test', async ctx => {
  ctx.body = {
    ok: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  };
});
`;
  
  content = content.slice(0, exportIndex) + testEndpoint + '\n\n' + content.slice(exportIndex);
}

// 6. Сохраним
fs.writeFileSync(authFile, content);
console.log('✓ Added GET auth.config endpoint');
console.log('✓ Added /test endpoint');

// 7. Проверим синтаксис
try {
  require(authFile);
  console.log('✓ Syntax check passed');
} catch (err) {
  console.error('✗ Syntax error:', err.message);
  
  // Восстановим из backup
  fs.copyFileSync(authFile + '.backup-fix', authFile);
  console.log('✓ Restored from backup');
}

console.log('\n=== Simple fix complete ===');