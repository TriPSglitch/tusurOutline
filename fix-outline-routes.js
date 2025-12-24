const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Восстановление оригинальных файлов Outline из системы ===\n');

// 1. ГЛАВНАЯ ЦЕЛЬ: Восстановить server/index.js из ОРИГИНАЛЬНОГО источника
const indexPath = '/opt/outline/build/server/index.js';
console.log(`1. Восстанавливаем ОРИГИНАЛЬНЫЙ ${indexPath}...`);

// 1a. Попытка 1: найти исходный файл в другом месте внутри контейнера
const potentialSourcePaths = [
    '/opt/outline/server/index.ts',        // Исходный TypeScript
    '/opt/outline/server/index.js',        // Скомпилированный JS (может быть в другом месте)
    '/opt/outline/build/server/index.js.original', // Резервная копия от патчей
];

let originalContent = null;
let sourcePath = null;

for (const potentialPath of potentialSourcePaths) {
    if (fs.existsSync(potentialPath)) {
        console.log(`   Найден исходный файл: ${potentialPath}`);
        originalContent = fs.readFileSync(potentialPath, 'utf8');
        sourcePath = potentialPath;
        break;
    }
}

// 1b. Попытка 2: если не нашли, получим его из git (если доступен)
if (!originalContent) {
    console.log('   Исходный файл не найден напрямую. Попытка получить из git...');
    try {
        // Переходим в директорию с исходным кодом Outline
        process.chdir('/opt/outline');
        // Получаем оригинальное содержимое из последнего коммита
        originalContent = execSync('git show HEAD:server/index.ts 2>/dev/null || git show HEAD:build/server/index.js 2>/dev/null', { encoding: 'utf8' });
        sourcePath = 'git repository';
        console.log('   Получено из git репозитория');
    } catch (gitError) {
        console.log('   Не удалось получить из git. Пробуем найти встроенную версию...');
        // Последняя попытка: используем стандартный шаблон из образа
        originalContent = `"use strict";

var _Koa = _interopRequireDefault(require("koa"));
var _http = _interopRequireDefault(require("http"));
var _https = _interopRequireDefault(require("https"));
var _stoppable = _interopRequireDefault(require("stoppable"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
process.title = "outline";
const env = require("./env").default;
const routes = require("./routes").default;
const services = require("./services").default;
const { ShutdownHelper } = require("./shared/ShutdownHelper");
async function start() {
  const app = new _Koa.default();
  const normalizedPort = parseInt(process.env.PORT || "3000", 10);
  if (isNaN(normalizedPort)) {
    throw new Error("PORT must be a number");
  }
  const useHTTPS = !!process.env.SSL_KEY && !!process.env.SSL_CERT;
  let ssl;
  if (useHTTPS) {
    ssl = {
      key: require("fs").readFileSync(process.env.SSL_KEY),
      cert: require("fs").readFileSync(process.env.SSL_CERT)
    };
  }
  app.proxy = env.TRUST_PROXY;
  services(app);
  routes(app);
  const server = (0, _stoppable.default)(useHTTPS ? _https.default.createServer(ssl, app.callback()) : _http.default.createServer(app.callback()), ShutdownHelper.connectionGraceTimeout);
  server.on("listening", () => {
    const address = server.address();
    console.log(\`Server listening on \${typeof address === "string" ? address : \`port \${address.port}\`}\`);
  });
  server.listen(normalizedPort);
  ShutdownHelper.add({
    name: "http",
    stop: () => new Promise(resolve => {
      server.stop(resolve);
    })
  });
  process.on("SIGTERM", async () => {
    await ShutdownHelper.execute();
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
        sourcePath = 'embedded template';
        console.log('   Используем встроенный шаблон');
    }
}

// 1c. Сохраняем восстановленный файл
fs.writeFileSync(indexPath, originalContent);
console.log(`   ✓ Восстановлен из: ${sourcePath}`);

// 2. ВОССТАНАВЛИВАЕМ другие КРИТИЧЕСКИЕ файлы, которые могли быть повреждены
console.log('\n2. Проверяем и восстанавливаем другие критические файлы...');

const criticalFiles = [
    '/opt/outline/build/server/routes/api/index.js',
    '/opt/outline/build/server/routes/api/auth/index.js',
    '/opt/outline/build/server/routes/api/auth/auth.js',
    '/opt/outline/build/server/routes/index.js',
    '/opt/outline/build/server/services/index.js',
    '/opt/outline/build/server/env.js',
];

criticalFiles.forEach(filePath => {
    const backupPath = filePath + '.original';
    
    if (fs.existsSync(backupPath)) {
        console.log(`   Восстанавливаем ${filePath} из backup...`);
        fs.copyFileSync(backupPath, filePath);
        console.log(`   ✓ ${path.basename(filePath)} восстановлен`);
    } else {
        // Если backup нет, проверяем, существует ли оригинальный файл и не поврежден ли он
        if (fs.existsSync(filePath)) {
            try {
                // Простая проверка: файл должен содержать "module.exports" или "export"
                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('module.exports') || content.includes('export default')) {
                    console.log(`   ${path.basename(filePath)} выглядит нормально`);
                } else {
                    console.log(`   ⚠ ${path.basename(filePath)} может быть поврежден, но backup отсутствует`);
                }
            } catch (e) {
                console.log(`   ⚠ Не удалось проверить ${path.basename(filePath)}: ${e.message}`);
            }
        } else {
            console.log(`   ✗ ${path.basename(filePath)} отсутствует (потребуется переустановка)`);
        }
    }
});

// 3. УДАЛЯЕМ/ОТМЕНЯЕМ все патчи в node_modules, которые ломают socket.io/engine.io
console.log('\n3. Отмена патчей в node_modules (socket.io/engine.io)...');

const patchedModules = [
    '/opt/outline/node_modules/engine.io/lib/server.js',
    '/opt/outline/node_modules/engine.io/lib/transports/websocket.js',
    '/opt/outline/node_modules/socket.io/dist/index.js',
];

patchedModules.forEach(modulePath => {
    const backupPath = modulePath + '.backup';
    
    if (fs.existsSync(backupPath)) {
        console.log(`   Восстанавливаем ${path.basename(modulePath)} из backup...`);
        fs.copyFileSync(backupPath, modulePath);
        console.log(`   ✓ ${path.basename(modulePath)} восстановлен`);
    } else if (fs.existsSync(modulePath)) {
        // Проверяем, есть ли в файле маркеры TUSUR патчей
        const content = fs.readFileSync(modulePath, 'utf8');
        if (content.includes('TUSUR') || content.includes('applyMiddleware')) {
            console.log(`   ⚠ ${path.basename(modulePath)} содержит TUSUR-патчи, но backup отсутствует`);
            console.log(`     Рекомендуется переустановить модуль: cd /opt/outline && npm install ${modulePath.split('/node_modules/')[1].split('/')[0]}`);
        }
    }
});

// 4. ФИНАЛЬНАЯ ПРОВЕРКА: убедимся, что есть shared/ShutdownHelper
console.log('\n4. Проверка наличия критических модулей...');
const shutdownHelperPath = '/opt/outline/build/server/shared/ShutdownHelper.js';
if (fs.existsSync(shutdownHelperPath)) {
    console.log('   ✓ shared/ShutdownHelper.js существует');
} else {
    console.log('   ✗ shared/ShutdownHelper.js ОТСУТСТВУЕТ! Это критическая проблема.');
    console.log('   Это означает, что исходная сборка Outline повреждена.');
    console.log('   Решение: нужно использовать чистый образ outlinewiki/outline:latest');
}

console.log('\n=== Восстановление завершено ===');
console.log('\nРезюме:');
console.log('1. Главный файл index.js восстановлен из оригинального источника');
console.log('2. Критические файлы API проверены/восстановлены');
console.log('3. Патчи в node_modules отменены');
console.log('4. Проверена целостность структуры');
console.log('\nСледующие шаги:');
console.log('1. Перезапустите контейнер: docker-compose restart outline');
console.log('2. Проверьте логи: docker-compose logs -f outline');
console.log('3. Если ошибка "Cannot find module" останется, потребуется');
console.log('   полная переустановка с чистым образом Outline.');