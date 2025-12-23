// patch-engineio-websocket.js
const fs = require('fs');
const path = require('path');

console.log('Patching engine.io to allow direct WebSocket connections...');

// Патчим engine.io server.js
const serverFiles = [
  '/opt/outline/node_modules/engine.io/build/server.js',
  '/opt/outline/node_modules/engine.io/lib/server.js'
];

for (const serverFile of serverFiles) {
  if (fs.existsSync(serverFile)) {
    console.log('Found engine.io server file:', serverFile);
    
    // Создаем backup
    const backupFile = serverFile + '.original';
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(serverFile, backupFile);
      console.log('Created backup:', backupFile);
    }
    
    let code = fs.readFileSync(serverFile, 'utf8');
    
    // КРИТИЧЕСКИ ВАЖНО: Отключаем проверку upgrade полностью
    // Ищем и заменяем функцию verify
    if (code.includes('function verify(req, upgrade, fn)')) {
      console.log('Patching verify function...');
      
      // Заменяем всю функцию verify на всегда успешную проверку
      code = code.replace(
        /function verify\(req, upgrade, fn\)\s*{[\s\S]*?^\s*}/m,
        `function verify(req, upgrade, fn) {
          // TUSUR PATCH: Always allow upgrade for WebSocket
          console.log('[TUSUR Engine.IO] Bypassing verify for WebSocket upgrade');
          fn(null, true);
        }`
      );
      
      fs.writeFileSync(serverFile, code);
      console.log('verify function patched');
    }
    
    // Также патчим middleware проверку
    if (code.includes('applyMiddleware')) {
      code = code.replace(
        /applyMiddleware n°1/g,
        'applyMiddleware n°0 // TUSUR: Disabled middleware check'
      );
      fs.writeFileSync(serverFile, code);
      console.log('applyMiddleware patched');
    }
    
    break;
  }
}

// Также патчим websocket.js транспорта
const websocketFiles = [
  '/opt/outline/node_modules/engine.io/build/transports/websocket.js',
  '/opt/outline/node_modules/engine.io/lib/transports/websocket.js'
];

for (const wsFile of websocketFiles) {
  if (fs.existsSync(wsFile)) {
    console.log('Found WebSocket transport file:', wsFile);
    
    let code = fs.readFileSync(wsFile, 'utf8');
    
    // Отключаем проверку запроса в WebSocket транспорте
    if (code.includes('function onUpgrade')) {
      code = code.replace(
        /function onUpgrade\(req, socket\)\s*{[\s\S]*?return false/m,
        `function onUpgrade(req, socket) {
          // TUSUR PATCH: Always allow WebSocket upgrade
          console.log('[TUSUR WebSocket] Allowing upgrade');
          return true`
      );
      
      fs.writeFileSync(wsFile, code);
      console.log('WebSocket onUpgrade patched');
    }
    
    break;
  }
}

console.log('Engine.io patching complete');