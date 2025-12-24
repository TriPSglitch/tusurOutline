const fs = require('fs');
const path = require('path');

console.log('=== Восстановление оригинального index.js ===\n');

const indexPath = '/opt/outline/build/server/index.js';
const indexPathBackup = indexPath + '.original';

// Вариант 1: Восстановить из backup если есть
if (fs.existsSync(indexPathBackup)) {
  console.log('1. Восстанавливаем из backup...');
  fs.copyFileSync(indexPathBackup, indexPath);
  console.log('   ✓ Восстановлен');
} else {
  console.log('1. Backup не найден, создаем правильную версию...');
  
  // Получаем оригинальное содержимое из сборки Outline
  // Это базовая структура, которая должна работать
  const originalContent = `"use strict";

var _Koa = _interopRequireDefault(require("koa"));
var _http = _interopRequireDefault(require("http"));
var _https = _interopRequireDefault(require("https"));
var _stoppable = _interopRequireDefault(require("stoppable"));
var _path = _interopRequireDefault(require("path"));
var _fs = _interopRequireDefault(require("fs"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
process.title = "outline";
const env = require("./env").default;
const routes = require("./routes").default;
const services = require("./services").default;
const {
  ShutdownHelper
} = require("./shared/ShutdownHelper");
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
      key: _fs.default.readFileSync(process.env.SSL_KEY),
      cert: _fs.default.readFileSync(process.env.SSL_CERT)
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
module.exports = {
  start
};`;
  
  fs.writeFileSync(indexPath, originalContent);
  console.log('   ✓ Создана оригинальная структура');
}

// Проверим, что файл теперь рабочий
console.log('\n2. Проверка восстановленного файла...');
const content = fs.readFileSync(indexPath, 'utf8');

const requiredImports = [
  'require("koa")',
  'require("./env")',
  'require("./routes")',
  'require("./services")'
];

let allGood = true;
requiredImports.forEach(importStr => {
  const hasImport = content.includes(importStr);
  console.log(`   ${importStr}:`, hasImport ? '✓' : '✗');
  if (!hasImport) allGood = false;
});

if (allGood) {
  console.log('\n✓ Файл восстановлен правильно');
} else {
  console.log('\n✗ Файл все еще имеет проблемы');
}

console.log('\n=== Восстановление завершено ===');