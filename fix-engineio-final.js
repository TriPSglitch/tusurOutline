const fs = require('fs');
const path = require('path');

console.log('Applying FINAL engine.io patch for TUSUR WebSocket...');

// 1. Engine.io server.js - КРИТИЧЕСКИЙ ПАТЧ
const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (fs.existsSync(engineServerFile)) {
  console.log('Patching engine.io server.js FINAL...');
  let code = fs.readFileSync(engineServerFile, 'utf8');

  // Патч verify функции - ПОЛНОСТЬЮ отключаем проверки
  code = code.replace(
    /function verify\(req,\s*upgrade,\s*fn\)\s*{[\s\S]*?fn\(null,\s*false\)/,
    `function verify(req, upgrade, fn) {
  // TUSUR FINAL PATCH: ALWAYS allow WebSocket
  console.log('[TUSUR Engine.IO FINAL] verify() -> ALLOW ALL');
  fn(null, true);`
  );

  // Патч applyMiddleware - ПОЛНОСТЬЮ пропускаем
  code = code.replace(
    /applyMiddleware n°1/g,
    '// TUSUR FINAL: middleware DISABLED\n      return fn(null, true); // applyMiddleware n°0'
  );

  fs.writeFileSync(engineServerFile, code);
  console.log('✓ engine.io server.js FINAL patched');
}

// 2. Socket.IO - тоже патчим
const socketIoFile = '/opt/outline/node_modules/socket.io/dist/index.js';
if (fs.existsSync(socketIoFile)) {
  console.log('Patching socket.io FINAL...');
  let code = fs.readFileSync(socketIoFile, 'utf8');

  // Отключаем ВСЕ CORS проверки в Socket.IO
  code = code.replace(
    /cors:\s*{[\s\S]*?}/g,
    `cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
      }`
  );

  fs.writeFileSync(socketIoFile, code);
  console.log('✓ socket.io FINAL patched');
}

// 3. Outline websockets.js
const outlineWsFile = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(outlineWsFile)) {
  console.log('Patching Outline websockets.js FINAL...');
  let code = fs.readFileSync(outlineWsFile, 'utf8');

  // Устанавливаем CORS для всех
  code = code.replace(
    /origin:\s*["'].*?["']/g,
    'origin: "*"'
  );

  fs.writeFileSync(outlineWsFile, code);
  console.log('✓ Outline websockets.js FINAL patched');
}

console.log('============================================');
console.log('FINAL WebSocket patches applied!');
console.log('============================================');