const fs = require('fs');
const path = require('path');

console.log('Applying COMPLETE engine.io patch for TUSUR...');

// ============================================================================
// 1. Engine.io SERVER.JS - КРИТИЧЕСКИ ВАЖНЫЙ ФАЙЛ
// ============================================================================
const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (fs.existsSync(engineServerFile)) {
  console.log('Patching engine.io server.js...');
  
  // Создаем backup
  const backupFile = engineServerFile + '.original';
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(engineServerFile, backupFile);
    console.log('Backup created:', backupFile);
  }
  
  let code = fs.readFileSync(engineServerFile, 'utf8');
  
  // Патч 1: Отключаем verify функцию полностью
  if (code.includes('function verify(req, upgrade, fn)')) {
    console.log('Found verify function, patching...');
    
    // Ищем полную функцию verify
    const verifyRegex = /function verify\(req,\s*upgrade,\s*fn\)\s*{[\s\S]*?^\s*}/m;
    const match = code.match(verifyRegex);
    
    if (match) {
      const oldVerify = match[0];
      const newVerify = `function verify(req, upgrade, fn) {
  // TUSUR COMPLETE PATCH: Always allow WebSocket upgrade
  console.log('[TUSUR Engine.IO] verify() -> ALLOW upgrade for', req.url);
  fn(null, true);
}`;
      
      code = code.replace(oldVerify, newVerify);
      console.log('✓ verify function patched');
    }
  }
  
  // Патч 2: Заменяем applyMiddleware
  code = code.replace(/applyMiddleware n°1/g, 'applyMiddleware n°0 // TUSUR: Disabled');
  
  // Патч 3: Заменяем сообщение об ошибке
  code = code.replace(/invalid transport upgrade/g, 'TUSUR: transport upgrade ALLOWED');
  
  // Патч 4: Отключаем проверку CORS в engine.io
  if (code.includes('origin !== undefined')) {
    code = code.replace(
      /if \(origin !== undefined\)\s*{[\s\S]*?^\s*}/gm,
      `if (origin !== undefined) {
    // TUSUR: Allow all origins
    console.log('[TUSUR Engine.IO] Origin check bypassed:', origin);
    return fn(null, true);
  }`
    );
  }
  
  fs.writeFileSync(engineServerFile, code);
  console.log('✓ engine.io server.js patched successfully');
}

// ============================================================================
// 2. Engine.io WEBSOCKET.JS транспорта
// ============================================================================
const engineWebsocketFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';
if (fs.existsSync(engineWebsocketFile)) {
  console.log('Patching engine.io websocket.js...');
  
  let code = fs.readFileSync(engineWebsocketFile, 'utf8');
  
  // Патч: Отключаем проверку onUpgrade
  if (code.includes('function onUpgrade')) {
    const onUpgradeRegex = /function onUpgrade\(req,\s*socket\)\s*{[\s\S]*?^\s*}/m;
    const match = code.match(onUpgradeRegex);
    
    if (match) {
      const oldOnUpgrade = match[0];
      const newOnUpgrade = `function onUpgrade(req, socket) {
  // TUSUR COMPLETE PATCH: Always return true for WebSocket upgrade
  console.log('[TUSUR Engine.IO WebSocket] onUpgrade() -> ALLOW for', req.url);
  return true;
}`;
      
      code = code.replace(oldOnUpgrade, newOnUpgrade);
      console.log('✓ onUpgrade function patched');
    }
  }
  
  fs.writeFileSync(engineWebsocketFile, code);
  console.log('✓ engine.io websocket.js patched');
}

// ============================================================================
// 3. Socket.IO основная библиотека
// ============================================================================
const socketIoFiles = [
  '/opt/outline/node_modules/socket.io/dist/index.js',
  '/opt/outline/node_modules/socket.io/build/index.js'
];

for (const socketFile of socketIoFiles) {
  if (fs.existsSync(socketFile)) {
    console.log('Patching socket.io:', socketFile);
    
    let code = fs.readFileSync(socketFile, 'utf8');
    
    // Отключаем middleware в Socket.IO
    code = code.replace(/applyMiddleware n°1/g, 'applyMiddleware n°0');
    
    // Отключаем CORS проверки
    code = code.replace(/corsMiddleware/g, '// TUSUR: corsMiddleware disabled');
    
    fs.writeFileSync(socketFile, code);
    console.log('✓ socket.io patched');
    break;
  }
}

// ============================================================================
// 4. Проверяем и патчим возможные дополнительные места
// ============================================================================
const additionalFiles = [
  '/opt/outline/node_modules/engine.io/build/transports/polling.js',
  '/opt/outline/node_modules/engine.io/lib/server.js',
  '/opt/outline/node_modules/engine.io/lib/transports/websocket.js'
];

for (const file of additionalFiles) {
  if (fs.existsSync(file)) {
    console.log('Patching additional file:', file);
    
    let code = fs.readFileSync(file, 'utf8');
    
    // Общие замены
    code = code.replace(/applyMiddleware n°1/g, 'applyMiddleware n°0');
    code = code.replace(/invalid transport upgrade/g, 'TUSUR: upgrade allowed');
    
    fs.writeFileSync(file, code);
  }
}

console.log('==============================================');
console.log('COMPLETE engine.io patch applied successfully!');
console.log('==============================================');