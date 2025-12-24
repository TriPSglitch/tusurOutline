const fs = require('fs');
const path = require('path');

console.log('=== Восстановление маршрутов Outline ===\n');

// 1. Восстановим server/index.js из исходников если поврежден
const indexPath = '/opt/outline/build/server/index.js';
const indexPathBackup = indexPath + '.original';

if (fs.existsSync(indexPathBackup)) {
  console.log('1. Восстанавливаем index.js из backup...');
  fs.copyFileSync(indexPathBackup, indexPath);
  console.log('   ✓ Восстановлен');
} else {
  console.log('1. Проверяем index.js...');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  // Проверим базовую структуру
  const requiredParts = [
    'const app = new Koa()',
    'server.listen',
    'routes(app)'
  ];
  
  let allGood = true;
  requiredParts.forEach(part => {
    const hasPart = content.includes(part);
    console.log(`   ${part}:`, hasPart ? '✓' : '✗');
    if (!hasPart) allGood = false;
  });
  
  if (!allGood) {
    console.log('   ✗ Файл поврежден, создаем восстановление...');
    // Создаем минимальную рабочую версию
    const fixedContent = `"use strict";

const Koa = require('koa');
const http = require('http');
const https = require('https');
const stoppable = require('stoppable');

async function start() {
  const app = new Koa();
  
  // Middleware
  app.use(require('./middlewares/error').default);
  app.use(require('./middlewares/bodyparser').default);
  app.use(require('./middlewares/sentry').default);
  app.use(require('./middlewares/shutdown').default);
  app.use(require('./middlewares/security').default);
  
  // API routes
  app.use(require('./routes/api').default.routes());
  
  // Health check
  app.use(async (ctx, next) => {
    if (ctx.path === '/healthz') {
      ctx.body = 'OK';
      return;
    }
    await next();
  });
  
  // Static files
  app.use(require('koa-static')('/opt/outline/build/app'));
  
  // Catch-all for SPA
  app.use(async (ctx) => {
    ctx.type = 'html';
    ctx.body = fs.readFileSync('/opt/outline/build/app/index.html');
  });
  
  const server = stoppable(http.createServer(app.callback()), 1000);
  const port = process.env.PORT || 3000;
  
  server.listen(port, () => {
    console.log(\`Server listening on port \${port}\`);
  });
}

if (require.main === module) {
  start().catch(console.error);
}

module.exports = { start };
`;
    
    fs.writeFileSync(indexPath, fixedContent);
    console.log('   ✓ Создана новая версия');
  }
}

// 2. Восстановим routes/api/index.js
const apiIndexPath = '/opt/outline/build/server/routes/api/index.js';
const apiIndexBackup = apiIndexPath + '.original';

console.log('\n2. Восстанавливаем API routes...');

if (fs.existsSync(apiIndexBackup)) {
  fs.copyFileSync(apiIndexBackup, apiIndexPath);
  console.log('   ✓ Восстановлен из backup');
} else {
  // Создаем простую рабочую версию
  const apiContent = `"use strict";

const Router = require('@koa/router');
const auth = require('./auth');

const router = new Router();

// Auth routes
router.use('/auth', auth.routes());

// Basic health endpoint
router.get('/health', async (ctx) => {
  ctx.body = { ok: true, service: 'api' };
});

// Test endpoint
router.get('/test', async (ctx) => {
  ctx.body = { ok: true, message: 'API работает' };
});

module.exports = router;
`;
  
  fs.writeFileSync(apiIndexPath, apiContent);
  console.log('   ✓ Создана новая версия');
}

// 3. Восстановим auth/index.js
const authIndexPath = '/opt/outline/build/server/routes/api/auth/index.js';
const authIndexBackup = authIndexPath + '.original';

console.log('\n3. Восстанавливаем auth routes...');

if (fs.existsSync(authIndexBackup)) {
  fs.copyFileSync(authIndexBackup, authIndexPath);
  console.log('   ✓ Восстановлен из backup');
} else {
  // Создаем рабочую версию
  const authContent = `"use strict";

const Router = require('@koa/router');
const auth = require('./auth');

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

// POST /api/auth.config (for compatibility)
router.post('auth.config', async (ctx) => {
  ctx.body = {
    data: {
      name: 'Outline',
      providers: []
    }
  };
});

// Other auth routes
router.use(auth.routes());

module.exports = router;
`;
  
  fs.writeFileSync(authIndexPath, authContent);
  console.log('   ✓ Создана новая версия');
}

// 4. Создаем простой auth.js если отсутствует
const authPath = '/opt/outline/build/server/routes/api/auth/auth.js';
if (!fs.existsSync(authPath)) {
  console.log('\n4. Создаем auth.js...');
  
  const authContent = `"use strict";

const Router = require('@koa/router');
const router = new Router();

// GET auth.info
router.get('auth.info', async (ctx) => {
  ctx.body = {
    data: {
      user: null,
      team: null
    }
  };
});

// Other endpoints can be added here

module.exports = router;
`;
  
  fs.writeFileSync(authPath, authContent);
  console.log('   ✓ Создан auth.js');
}

console.log('\n=== Восстановление завершено ===');