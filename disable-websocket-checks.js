// disable-websocket-checks.js
const fs = require('fs');
const path = require('path');

console.log('Disabling all WebSocket checks...');

// Основной файл websockets.js
const websocketFile = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(websocketFile)) {
  let code = fs.readFileSync(websocketFile, 'utf8');
  
  // 1. Убираем middleware полностью
  if (code.includes('engine.applyMiddleware')) {
    code = code.replace(
      /engine\.applyMiddleware n°1/g,
      '// TUSUR: Middleware disabled for WebSocket'
    );
    
    // Также убираем invalid transport upgrade
    code = code.replace(
      /engine invalid transport upgrade/g,
      'TUSUR: WebSocket upgrade allowed'
    );
  }
  
  // 2. Гарантируем, что upgrade handler работает
  if (code.includes('[TUSUR UPGRADE]')) {
    // Убедимся, что handler вызывается
    code = code.replace(
      /server\.on\("upgrade", function \(req, socket, head\) {/,
      `server.on("upgrade", function (req, socket, head) {
    console.log('[TUSUR FINAL] WebSocket upgrade attempt:', req.url, 'headers:', req.headers);
    
    // ВСЕГДА обрабатываем /realtime
    if (req.url && req.url.includes('/realtime')) {
      console.log('[TUSUR FINAL] Processing WebSocket upgrade for /realtime');
      if (ioHandleUpgrade) {
        ioHandleUpgrade(req, socket, head);
        return;
      }
    }`
    );
  }
  
  fs.writeFileSync(websocketFile, code);
  console.log('WebSocket checks disabled');
}

// Также патчим env.js для гарантии
const envFile = '/opt/outline/build/server/env.js';
if (fs.existsSync(envFile)) {
  let code = fs.readFileSync(envFile, 'utf8');
  
  // Гарантируем isCloudHosted = true
  if (!code.includes('isCloudHosted: true')) {
    code = code.replace(
      /isCloudHosted:\s*[^,}]+/,
      'isCloudHosted: true // TUSUR: Cloud hosted mode'
    );
  }
  
  fs.writeFileSync(envFile, code);
  console.log('env.js verified');
}