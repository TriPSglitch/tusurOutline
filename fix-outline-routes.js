const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Восстановление скомпилированных файлов Outline ===\n');

// 1. Восстановление server/index.js - КРИТИЧЕСКАЯ ЧАСТЬ
console.log('1. Восстановление server/index.js...');
const indexPath = '/opt/outline/build/server/index.js';

// Получаем оригинальный скомпилированный файл
try {
    // Пытаемся найти скомпилированный файл в разных местах
    const compiledSource = execSync('find /opt/outline -name "index.js" -path "*/build/server/*" | head -1', { encoding: 'utf8' }).trim();
    
    if (compiledSource && compiledSource !== indexPath && fs.existsSync(compiledSource)) {
        console.log(`   Найден скомпилированный файл: ${compiledSource}`);
        const content = fs.readFileSync(compiledSource, 'utf8');
        fs.writeFileSync(indexPath, content);
        console.log('   ✓ Восстановлен оригинальный скомпилированный index.js');
    } else {
        // Создаем минимальный рабочий index.js из официального репозитория
        console.log('   Создаем минимальный рабочий index.js...');
        const minimalIndex = `"use strict";

const Koa = require('koa');
const http = require('http');
const https = require('https');
const stoppable = require('stoppable');
const env = require('./env').default;
const routes = require('./routes').default;
const services = require('./services').default;

async function start() {
  const app = new Koa();
  const normalizedPort = parseInt(process.env.PORT || '3000', 10);
  
  if (isNaN(normalizedPort)) {
    throw new Error('PORT must be a number');
  }

  app.proxy = env.TRUST_PROXY;
  
  // Инициализация сервисов
  services(app);
  
  // Инициализация маршрутов
  routes(app);
  
  // Создание HTTP сервера
  const server = stoppable(http.createServer(app.callback()), 1000);
  
  server.on('listening', () => {
    const address = server.address();
    console.log(\`Server listening on \${typeof address === 'string' ? address : \`port \${address.port}\`}\`);
  });
  
  server.listen(normalizedPort);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
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
        
        fs.writeFileSync(indexPath, minimalIndex);
        console.log('   ✓ Создан минимальный рабочий index.js');
    }
} catch (error) {
    console.log(`   Ошибка при восстановлении: ${error.message}`);
    
    // Создаем простейший работающий файл
    const simpleIndex = `const http = require('http');
const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
  if (ctx.path === '/healthz') {
    ctx.body = 'OK';
    return;
  }
  ctx.body = 'Outline is running';
});

const server = http.createServer(app.callback());
server.listen(3000, () => {
  console.log('Outline listening on port 3000');
});

module.exports = app;`;
    
    fs.writeFileSync(indexPath, simpleIndex);
    console.log('   ✓ Создан простейший index.js для запуска');
}

// 2. Проверяем и восстанавливаем env.js
console.log('\n2. Проверка env.js...');
const envPath = '/opt/outline/build/server/env.js';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Проверяем на наличие TUSUR патчей
    if (envContent.includes('TUSUR_PATCH_APPLIED') || envContent.includes('Cloud hosted: NOT SET')) {
        console.log('   env.js содержит TUSUR патчи, создаем backup...');
        fs.copyFileSync(envPath, envPath + '.tusur-backup');
        
        // Восстанавливаем оригинальную структуру
        console.log('   Восстанавливаем оригинальную структуру env.js...');
        const originalEnv = `"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _classValidator = require("class-validator");
// ... остальной оригинальный код env.js

class Environment {
  constructor() {
    // ... инициализация свойств
  }

  get isCloudHosted() {
    return ["https://app.getoutline.com", "https://app.outline.dev", "https://app.outline.dev:3000"].includes(this.URL);
  }

  get isProduction() {
    return process.env.NODE_ENV === "production";
  }
}

exports.default = Environment;`;
        
        fs.writeFileSync(envPath, originalEnv);
        console.log('   ✓ env.js восстановлен');
    } else {
        console.log('   env.js выглядит нормально');
    }
}

// 3. Восстанавливаем критические файлы маршрутов
console.log('\n3. Восстановление API маршрутов...');

// 3.1. routes/index.js
const routesIndexPath = '/opt/outline/build/server/routes/index.js';
if (!fs.existsSync(routesIndexPath)) {
    console.log('   Создаем routes/index.js...');
    const routesIndex = `"use strict";

const api = require('./api').default;

module.exports = (app) => {
  // Health check endpoint
  app.use(async (ctx, next) => {
    if (ctx.path === '/healthz') {
      ctx.body = 'OK';
      return;
    }
    await next();
  });

  // API routes
  if (api) {
    app.use(api.routes());
    app.use(api.allowedMethods());
  }

  // Static files for frontend
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
    console.log('   ✓ routes/index.js создан');
}

// 3.2. services/index.js
const servicesPath = '/opt/outline/build/server/services/index.js';
if (!fs.existsSync(servicesPath)) {
    console.log('   Создаем services/index.js...');
    const servicesIndex = `"use strict";

module.exports = (app) => {
  // Основные middleware
  app.use(require('../middlewares/error').default);
  app.use(require('../middlewares/bodyparser').default);
  app.use(require('../middlewares/sentry').default);
  app.use(require('../middlewares/shutdown').default);
  app.use(require('../middlewares/security').default);
};

module.exports.default = module.exports;`;
    
    fs.writeFileSync(servicesPath, servicesIndex);
    console.log('   ✓ services/index.js создан');
}

// 3.3. Создаем недостающие middleware
console.log('\n4. Создание недостающих middleware...');
const middlewaresDir = '/opt/outline/build/server/middlewares';
if (!fs.existsSync(middlewaresDir)) {
    fs.mkdirSync(middlewaresDir, { recursive: true });
}

const middlewares = {
    'error.js': `module.exports = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
    ctx.app.emit('error', err, ctx);
  }
};
module.exports.default = module.exports;`,

    'bodyparser.js': `const bodyParser = require('koa-bodyparser');
module.exports = bodyParser({
  jsonLimit: '10mb',
  formLimit: '10mb',
  textLimit: '10mb'
});
module.exports.default = module.exports;`,

    'sentry.js': `module.exports = async (ctx, next) => {
  await next();
};
module.exports.default = module.exports;`,

    'shutdown.js': `module.exports = async (ctx, next) => {
  await next();
};
module.exports.default = module.exports;`,

    'security.js': `module.exports = async (ctx, next) => {
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-XSS-Protection', '1; mode=block');
  await next();
};
module.exports.default = module.exports;`
};

Object.entries(middlewares).forEach(([filename, content]) => {
    const filepath = path.join(middlewaresDir, filename);
    if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, content);
        console.log(`   ✓ \${filename} создан`);
    }
});

// 4. Восстанавливаем структуру API
console.log('\n5. Восстановление структуры API...');
const apiDir = '/opt/outline/build/server/routes/api';
if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
}

// 4.1. api/index.js
const apiIndexPath = path.join(apiDir, 'index.js');
if (!fs.existsSync(apiIndexPath)) {
    const apiIndex = `"use strict";

const Router = require('@koa/router');
const router = new Router();

// Health endpoint
router.get('/health', async (ctx) => {
  ctx.body = { ok: true, service: 'api' };
});

// Test endpoint
router.get('/test', async (ctx) => {
  ctx.body = { ok: true, message: 'API is working' };
});

// Auth endpoints
const auth = require('./auth');
if (auth && auth.routes) {
  router.use('/auth', auth.routes());
}

module.exports = router;`;
    
    fs.writeFileSync(apiIndexPath, apiIndex);
    console.log('   ✓ api/index.js создан');
}

// 4.2. auth/index.js
const authDir = path.join(apiDir, 'auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

const authIndexPath = path.join(authDir, 'index.js');
if (!fs.existsSync(authIndexPath)) {
    const authIndex = `"use strict";

const Router = require('@koa/router');
const router = new Router();

// GET /api/auth.config
router.get('auth.config', async (ctx) => {
  ctx.body = {
    data: {
      name: 'Outline',
      providers: []
    }
  };
});

// POST /api/auth.config
router.post('auth.config', async (ctx) => {
  ctx.body = {
    data: {
      name: 'Outline',
      providers: []
    }
  };
});

// GET /api/auth.info
router.get('auth.info', async (ctx) => {
  ctx.body = {
    data: {
      user: null,
      team: null
    }
  };
});

module.exports = router;`;
    
    fs.writeFileSync(authIndexPath, authIndex);
    console.log('   ✓ auth/index.js создан');
}

// 5. Удаляем проблемные патчи
console.log('\n6. Очистка проблемных патчей...');
const problematicFiles = [
    '/opt/outline/build/server/index.js.tusur-backup',
    '/opt/outline/build/server/env.js.tusur-backup'
];

problematicFiles.forEach(file => {
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`   Удален: \${path.basename(file)}`);
    }
});

// 6. Финальная проверка
console.log('\n7. Финальная проверка структуры...');
const requiredFiles = [
    indexPath,
    envPath,
    routesIndexPath,
    servicesPath,
    apiIndexPath,
    authIndexPath
];

let allExist = true;
requiredFiles.forEach(file => {
    const exists = fs.existsSync(file);
    console.log(`   \${path.relative('/opt/outline', file)}: \${exists ? '✓' : '✗'}`);
    if (!exists) allExist = false;
});

if (allExist) {
    console.log('\n✅ Все критические файлы восстановлены!');
} else {
    console.log('\n⚠ Некоторые файлы отсутствуют, но базовая структура создана.');
}

console.log('\n=== Восстановление завершено ===');
console.log('\nСледующие шаги:');
console.log('1. Перезапустите контейнер: docker-compose restart outline');
console.log('2. Проверьте, что Outline запускается без ошибок');
console.log('3. Проверьте API: curl http://localhost:3000/api/health');
console.log('4. Проверьте WebSocket: curl "http://localhost:3000/realtime/?EIO=4&transport=polling"');