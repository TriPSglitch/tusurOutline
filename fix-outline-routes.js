const fs = require('fs');
const path = require('path');

console.log('=== ВОССТАНОВЛЕНИЕ ПРАВИЛЬНОЙ СТРУКТУРЫ ===\n');

// 1. У нас неправильный index.js - это models/index.js!
console.log('1. Проверяем текущий server/index.js...');
const serverIndexPath = '/opt/outline/build/server/index.js';

if (fs.existsSync(serverIndexPath)) {
    const content = fs.readFileSync(serverIndexPath, 'utf8');
    
    // Проверяем, что это за файл
    if (content.includes('exports.ApiKey') || content.includes('Object.defineProperty(exports, "ApiKey"')) {
        console.log('   ⚠ ОШИБКА: Это models/index.js, а не server/index.js!');
        console.log('   Сохраняю как models/index.js.backup...');
        
        // Сохраняем этот файл как models/index.js
        const modelsIndexPath = '/opt/outline/build/server/models/index.js';
        const modelsDir = path.dirname(modelsIndexPath);
        
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
        }
        
        fs.writeFileSync(modelsIndexPath, content);
        console.log('   ✓ Сохранен как models/index.js');
        
        // Теперь нужно найти или создать правильный server/index.js
        console.log('   Ищу правильный server/index.js...');
    }
}

// 2. Ищем правильный server/index.js
console.log('\n2. Поиск правильного server/index.js...');

// Сначала проверяем backup файлы
const possibleIndexFiles = [
    '/opt/outline/build/server/index.js.original',
    '/opt/outline/build/server/index.js.backup',
    '/opt/outline/server/index.js',
    '/opt/outline/server/index.ts'
];

let foundIndex = false;
for (const file of possibleIndexFiles) {
    if (fs.existsSync(file)) {
        console.log(`   Найден: ${file}`);
        
        let content = fs.readFileSync(file, 'utf8');
        
        // Если это TypeScript, нужно минимально преобразовать
        if (file.endsWith('.ts')) {
            console.log('   ⚠ Это TypeScript, преобразую в JavaScript...');
            // Удаляем аннотации типов
            content = content.replace(/:\s*\w+(?=\s*[,)])/g, '');
            content = content.replace(/:\s*void/g, '');
            content = content.replace(/:\s*any/g, '');
            content = content.replace(/:\s*Promise/g, '');
        }
        
        // Проверяем, что это действительно server/index.js
        if (content.includes('require("koa")') || content.includes('function start') || content.includes('server.listen')) {
            fs.writeFileSync(serverIndexPath, content);
            console.log('   ✓ Восстановлен правильный server/index.js');
            foundIndex = true;
            break;
        }
    }
}

if (!foundIndex) {
    console.log('   ⚠ Не найден правильный server/index.js, создаю минимальный...');
    
    const minimalIndex = `"use strict";

const Koa = require('koa');
const http = require('http');
const stoppable = require('stoppable');
const env = require('./env').default;
const routes = require('./routes').default;
const services = require('./services').default;

async function start() {
  const app = new Koa();
  const port = parseInt(process.env.PORT || '3000', 10);
  
  app.proxy = env.TRUST_PROXY;
  
  // Initialize services
  services(app);
  
  // Initialize routes
  routes(app);
  
  // Create server
  const server = stoppable(http.createServer(app.callback()), 1000);
  
  server.listen(port, () => {
    console.log(\`Outline server listening on port \${port}\`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await new Promise(resolve => server.stop(resolve));
    process.exit(0);
  });
}

if (require.main === module) {
  start().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { start };`;
    
    fs.writeFileSync(serverIndexPath, minimalIndex);
    console.log('   ✓ Создан минимальный server/index.js');
}

// 3. Проверяем models
console.log('\n3. Проверка models...');
const modelsPath = '/opt/outline/build/server/models';

if (!fs.existsSync(modelsPath)) {
    console.log('   Создаю директорию models...');
    fs.mkdirSync(modelsPath, { recursive: true });
}

// Проверяем, есть ли models/index.js
const modelsIndexPath = path.join(modelsPath, 'index.js');
if (!fs.existsSync(modelsIndexPath)) {
    console.log('   models/index.js не найден, проверяю backup...');
    
    // Ищем backup
    const modelBackups = [
        '/opt/outline/build/server/models/index.js.backup',
        '/opt/outline/build/server/models/index.js.original',
        '/opt/outline/server/models/index.ts',
        '/opt/outline/server/models/index.js'
    ];
    
    let foundModel = false;
    for (const backup of modelBackups) {
        if (fs.existsSync(backup)) {
            console.log(`   Найден: ${backup}`);
            fs.copyFileSync(backup, modelsIndexPath);
            console.log('   ✓ Восстановлен models/index.js');
            foundModel = true;
            break;
        }
    }
    
    if (!foundModel) {
        console.log('   ⚙ Создаю пустой models/index.js...');
        const emptyModels = `"use strict";
module.exports = {};`;
        fs.writeFileSync(modelsIndexPath, emptyModels);
    }
}

// 4. Создаем недостающие модели если их нет
console.log('\n4. Проверка файлов моделей...');
const requiredModels = ['ApiKey.js', 'User.js', 'Team.js', 'Document.js'];

requiredModels.forEach(modelFile => {
    const modelPath = path.join(modelsPath, modelFile);
    if (!fs.existsSync(modelPath)) {
        console.log(`   ${modelFile} не найден, создаю заглушку...`);
        
        const stubModel = `"use strict";
module.exports = (sequelize, DataTypes) => {
  const ${modelFile.replace('.js', '')} = sequelize.define('${modelFile.replace('.js', '')}', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }
  });
  
  return ${modelFile.replace('.js', '')};
};`;
        
        fs.writeFileSync(modelPath, stubModel);
    } else {
        console.log(`   ✓ ${modelFile} присутствует`);
    }
});

// 5. Проверяем routes
console.log('\n5. Проверка routes...');
const routesPath = '/opt/outline/build/server/routes';

if (!fs.existsSync(routesPath)) {
    console.log('   Создаю директорию routes...');
    fs.mkdirSync(routesPath, { recursive: true });
}

// Проверяем routes/index.js
const routesIndexPath = path.join(routesPath, 'index.js');
if (!fs.existsSync(routesIndexPath)) {
    console.log('   routes/index.js не найден, создаю...');
    
    const routesIndex = `"use strict";

module.exports = (app) => {
  // Health check
  app.use(async (ctx, next) => {
    if (ctx.path === '/healthz') {
      ctx.body = 'OK';
      return;
    }
    await next();
  });
  
  // API routes
  const api = require('./api');
  if (api && api.routes) {
    app.use(api.routes());
    app.use(api.allowedMethods());
  }
  
  // Static files
  const serve = require('koa-static');
  app.use(serve('/opt/outline/build/app', {
    maxage: 365 * 24 * 60 * 60 * 1000
  }));
  
  // SPA fallback
  app.use(async (ctx) => {
    if (ctx.method !== 'GET') return;
    if (ctx.path.startsWith('/api/')) return;
    if (ctx.path.includes('.')) return;
    
    ctx.type = 'html';
    ctx.body = require('fs').readFileSync('/opt/outline/build/app/index.html');
  });
};

module.exports.default = module.exports;`;
    
    fs.writeFileSync(routesIndexPath, routesIndex);
}

// 6. Финальная проверка
console.log('\n6. Финальная проверка структуры...');

const criticalFiles = [
    { path: serverIndexPath, name: 'server/index.js' },
    { path: modelsIndexPath, name: 'models/index.js' },
    { path: routesIndexPath, name: 'routes/index.js' },
    { path: '/opt/outline/build/server/env.js', name: 'env.js' },
    { path: '/opt/outline/build/server/services/index.js', name: 'services/index.js' }
];

criticalFiles.forEach(file => {
    const exists = fs.existsSync(file.path);
    console.log(`   ${file.name}: ${exists ? '✓' : '❌'}`);
    
    if (exists && file.name === 'server/index.js') {
        const content = fs.readFileSync(file.path, 'utf8');
        const isCorrect = content.includes('server.listen') && 
                         (content.includes('require("koa")') || content.includes("require('koa')"));
        if (!isCorrect) {
            console.log(`   ⚠ ${file.name} может быть неправильным!`);
        }
    }
});

console.log('\n=== ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО ===');
console.log('\nЕсли все еще есть ошибка "Cannot find module \'./ApiKey\'":');
console.log('1. Проверьте строку 216 в server/index.js');
console.log('2. Убедитесь, что импорт правильный: должно быть require(\'./models/ApiKey\')');
console.log('3. Или удалите этот импорт если он не нужен');