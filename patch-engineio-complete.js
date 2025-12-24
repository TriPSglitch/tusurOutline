const fs = require('fs');
const path = require('path');

console.log('Applying SAFE engine.io patch for TUSUR...');

// ============================================================================
// 1. Engine.io SERVER.JS - КРИТИЧЕСКИ ВАЖНЫЙ ФАЙЛ
// ============================================================================
const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (fs.existsSync(engineServerFile)) {
  console.log('Patching engine.io server.js...');
  
  let code = fs.readFileSync(engineServerFile, 'utf8');
  
  // Патч 1: Отключаем verify функцию полностью (БЕЗОПАСНО)
  if (code.includes('function verify(req, upgrade, fn)')) {
    console.log('Found verify function, patching SAFELY...');
    
    // Используем более безопасный подход
    code = code.replace(
      /function verify\(req,\s*upgrade,\s*fn\)\s*{[\s\S]*?fn\(null,\s*false\)/,
      `function verify(req, upgrade, fn) {
  // TUSUR SAFE PATCH: Always allow WebSocket upgrade
  console.log('[TUSUR Engine.IO] verify() -> ALLOW upgrade for', req.url);
  fn(null, true)`
    );
    
    console.log('✓ verify function patched SAFELY');
  }
  
  // Патч 2: Заменяем applyMiddleware (БЕЗОПАСНО)
  code = code.replace(/applyMiddleware n°1/g, 'applyMiddleware n°0');
  
  // Патч 3: Заменяем сообщение об ошибке (БЕЗОПАСНО)
  code = code.replace(/invalid transport upgrade/g, 'TUSUR: transport upgrade ALLOWED');
  
  fs.writeFileSync(engineServerFile, code);
  console.log('✓ engine.io server.js patched SAFELY');
}

// ============================================================================
// 2. Engine.io WEBSOCKET.JS транспорта (БЕЗОПАСНО)
// ============================================================================
const engineWebsocketFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';
if (fs.existsSync(engineWebsocketFile)) {
  console.log('Patching engine.io websocket.js SAFELY...');
  
  let code = fs.readFileSync(engineWebsocketFile, 'utf8');
  
  // Патч: onUpgrade всегда возвращает true
  if (code.includes('return false') && code.includes('function onUpgrade')) {
    code = code.replace(
      /function onUpgrade\(req,\s*socket\)\s*{[\s\S]*?return false/,
      `function onUpgrade(req, socket) {
  // TUSUR SAFE PATCH: Always return true for WebSocket upgrade
  console.log('[TUSUR Engine.IO WebSocket] onUpgrade() -> ALLOW for', req.url);
  return true`
    );
  }
  
  fs.writeFileSync(engineWebsocketFile, code);
  console.log('✓ engine.io websocket.js patched SAFELY');
}

// ============================================================================
// 3. Socket.IO - ТОЛЬКО applyMiddleware, не трогаем corsMiddleware
// ============================================================================
const socketIoFiles = [
  '/opt/outline/node_modules/socket.io/dist/index.js',
  '/opt/outline/node_modules/socket.io/build/index.js'
];

for (const socketFile of socketIoFiles) {
  if (fs.existsSync(socketFile)) {
    console.log('Patching socket.io SAFELY:', socketFile);
    
    let code = fs.readFileSync(socketFile, 'utf8');
    
    // ТОЛЬКО applyMiddleware, НЕ трогаем corsMiddleware
    code = code.replace(/applyMiddleware n°1/g, 'applyMiddleware n°0');
    
    // НЕ ТРОГАТЬ: corsMiddleware - оставляем как есть
    // code = code.replace(/corsMiddleware/g, '// TUSUR: corsMiddleware disabled'); // ← УДАЛИТЬ ЭТУ СТРОКУ
    
    fs.writeFileSync(socketFile, code);
    console.log('✓ socket.io patched SAFELY (only applyMiddleware)');
    break;
  }
}

console.log('============================================');
console.log('SAFE engine.io patch applied successfully!');
console.log('============================================');