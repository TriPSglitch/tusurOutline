const fs = require('fs');
const path = require('path');

console.log('Adding GET endpoint for auth.config...');

const authApiFile = '/opt/outline/build/server/routes/api/auth/auth.js';

if (!fs.existsSync(authApiFile)) {
  console.error('auth.js not found');
  process.exit(1);
}

let content = fs.readFileSync(authApiFile, 'utf8');

// 1. Найдем POST "auth.config"
const postConfigIndex = content.indexOf('router.post("auth.config"');
if (postConfigIndex === -1) {
  console.error('POST auth.config not found');
  process.exit(1);
}

console.log('Found POST auth.config at index', postConfigIndex);

// 2. Найдем конец этого обработчика
let handlerEnd = postConfigIndex;
let braceCount = 0;
let inHandler = false;

for (let i = postConfigIndex; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    inHandler = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (inHandler && braceCount === 0) {
      handlerEnd = i + 1;
      break;
    }
  }
}

if (handlerEnd <= postConfigIndex) {
  console.error('Could not find end of handler');
  process.exit(1);
}

// 3. Извлечем обработчик
const postHandler = content.substring(postConfigIndex, handlerEnd);
console.log('POST handler length:', postHandler.length);

// 4. Создаем GET handler на основе POST handler
const getHandler = postHandler.replace(
  'router.post("auth.config"',
  'router.get("auth.config"'
);

// 5. Вставим GET handler сразу после POST handler
content = content.slice(0, handlerEnd) + '\n\n' + getHandler + content.slice(handlerEnd);

// 6. Также добавим простой GET для тестирования
const simpleGetHandler = `
// Simple test endpoint
router.get('/test', async ctx => {
  ctx.body = {
    ok: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  };
});
`;

// Вставим после GET auth.config
const getConfigEnd = content.indexOf('router.get("auth.config"') + getHandler.length;
content = content.slice(0, getConfigEnd) + '\n\n' + simpleGetHandler + content.slice(getConfigEnd);

// 7. Сохраним
fs.writeFileSync(authApiFile, content);
console.log('✓ Added GET auth.config endpoint');
console.log('✓ Added /test endpoint for testing');

// 8. Также добавим в другие места для уверенности
console.log('\nAdding health endpoint to API index...');

const apiIndexFile = '/opt/outline/build/server/routes/api/index.js';
if (fs.existsSync(apiIndexFile)) {
  let apiIndexContent = fs.readFileSync(apiIndexFile, 'utf8');
  
  // Найдем где добавить (после middlewares, перед plugin hooks)
  const middlewaresEnd = apiIndexContent.indexOf('// Register plugin API routes');
  if (middlewaresEnd !== -1) {
    const healthRoute = `
// Health check endpoint
router.get('/health', async ctx => {
  ctx.body = { ok: true, service: 'api' };
});
`;
    
    apiIndexContent = apiIndexContent.slice(0, middlewaresEnd) + healthRoute + apiIndexContent.slice(middlewaresEnd);
    fs.writeFileSync(apiIndexFile, apiIndexContent);
    console.log('✓ Added /api/health endpoint');
  }
}

console.log('\n=== Fix complete ===');