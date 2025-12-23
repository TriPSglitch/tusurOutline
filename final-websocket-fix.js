const fs = require('fs');

console.log('Applying ultimate WebSocket fix...');

// 1. Патчим engine.io lib/server.js
const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (fs.existsSync(engineServerFile)) {
  let code = fs.readFileSync(engineServerFile, 'utf8');
  
  // Находим и заменяем проверку upgrade
  const verifyPattern = /function verify\(req, upgrade, fn\)\s*{[\s\S]*?(fn\(null,\s*false\)|fn\(err\))/;
  if (code.match(verifyPattern)) {
    code = code.replace(
      verifyPattern,
      `function verify(req, upgrade, fn) {
        // TUSUR ULTIMATE PATCH: Always allow upgrade
        console.log('[TUSUR ENGINE] Skipping verify, allowing all upgrades');
        fn(null, true);
        return;`
    );
    fs.writeFileSync(engineServerFile, code);
    console.log('Engine.io verify function patched');
  }
}

// 2. Патчим основной websockets.js Outline
const outlineWebsocketFile = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(outlineWebsocketFile)) {
  let code = fs.readFileSync(outlineWebsocketFile, 'utf8');
  
  // Убедимся, что upgrade handler корректно работает
  if (code.includes('socket.end(`HTTP/1.1 400 Bad Request')) {
    code = code.replace(
      /socket\.end\(`HTTP\/1\.1 400 Bad Request/,
      '// TUSUR: Allow all upgrades\n      console.log(\'[TUSUR] Allowing WebSocket upgrade\');\n      if (ioHandleUpgrade) {\n        ioHandleUpgrade(req, socket, head);\n        return;\n      }\n      socket.end(`HTTP/1.1 400 Bad Request'
    );
    fs.writeFileSync(outlineWebsocketFile, code);
    console.log('Outline WebSocket handler patched');
  }
}

// 3. Патчим Socket.IO engine
const socketIoEngineFile = '/opt/outline/node_modules/socket.io/dist/index.js';
if (fs.existsSync(socketIoEngineFile)) {
  let code = fs.readFileSync(socketIoEngineFile, 'utf8');
  
  if (code.includes('applyMiddleware')) {
    code = code.replace(
      /applyMiddleware n°1/g,
      'applyMiddleware n°0 // TUSUR: Disabled'
    );
    fs.writeFileSync(socketIoEngineFile, code);
    console.log('Socket.IO middleware patched');
  }
}

console.log('Ultimate WebSocket fix applied');