const fs = require('fs');
const path = require('path');

console.log('Looking for engine.io configuration...');

// Ищем файлы engine.io
const searchPaths = [
  '/opt/outline/node_modules/engine.io/build/transports/websocket.js',
  '/opt/outline/node_modules/engine.io/lib/transports/websocket.js'
];

for (const engineFile of searchPaths) {
  if (fs.existsSync(engineFile)) {
    console.log('Found engine.io WebSocket file:', engineFile);
    
    let code = fs.readFileSync(engineFile, 'utf8');
    
    // Отключаем все проверки
    if (code.includes('function onUpgrade')) {
      code = code.replace(
        /function onUpgrade\(req, socket\)/g,
        `function onUpgrade(req, socket) {
        console.log('[TUSUR Engine.IO] Upgrade request:', req.url);
        return true; // Всегда разрешаем`
      );
      fs.writeFileSync(engineFile, code);
      console.log('Patched engine.io WebSocket handler');
    }
    break;
  }
}

// Также проверяем файл server
const serverFile = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(serverFile)) {
  let code = fs.readFileSync(serverFile, 'utf8');
  
  // Убираем middleware из engine.io
  code = code.replace(
    /engine\.applyMiddleware n°1/g,
    'engine.applyMiddleware n°0 // TUSUR: No middleware'
  );
  
  // Отключаем все middleware checks
  code = code.replace(
    /engine\.applyMiddleware/g,
    '// TUSUR: middleware disabled'
  );
  
  fs.writeFileSync(serverFile, code);
  console.log('Disabled engine.io middleware');
}