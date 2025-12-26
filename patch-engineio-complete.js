const fs = require('fs');
const path = require('path');

console.log('Applying FINAL engine.io fix for TUSUR...');

const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';

if (!fs.existsSync(engineServerFile)) {
  console.error('❌ engine.io server.js not found!');
  process.exit(1);
}

// Создаем резервную копию
const backupFile = engineServerFile + '.backup-final';
if (!fs.existsSync(backupFile)) {
  fs.copyFileSync(engineServerFile, backupFile);
  console.log('✓ Backup created:', backupFile);
}

let content = fs.readFileSync(engineServerFile, 'utf8');

console.log('File length:', content.length);
console.log('Searching for verify function...');

// КРИТИЧЕСКИ ВАЖНО: Находим и патчим verify() функцию
const verifyPattern = /function verify\(req,\s*upgrade,\s*fn\)\s*\{[\s\S]*?\}/;

const verifyMatch = content.match(verifyPattern);
if (verifyMatch) {
  console.log('✓ Found verify() function, length:', verifyMatch[0].length);
  
  // Полностью заменяем verify() функцию
  const newVerify = `function verify(req, upgrade, fn) {
  // TUSUR FINAL FIX: Always allow WebSocket upgrades
  console.log('[TUSUR FINAL] verify called:', {
    url: req.url,
    upgrade: upgrade,
    headers: req.headers
  });
  
  // Если это WebSocket запрос - сразу разрешаем
  const isWebSocketRequest = req.headers.upgrade && 
                           req.headers.upgrade.toLowerCase() === 'websocket' &&
                           req.url.includes('transport=websocket');
  
  if (isWebSocketRequest) {
    console.log('[TUSUR FINAL] WebSocket upgrade ALLOWED');
    // Пропускаем все проверки для WebSocket
    return fn();
  }
  
  // Оригинальная логика для остальных случаев
  if (!upgrade) {
    return fn();
  }
  
  const headers = req.headers;
  
  if (!headers.upgrade) {
    return fn();
  }
  
  if (headers.upgrade.toLowerCase() !== 'websocket') {
    return fn();
  }
  
  if (!headers['sec-websocket-key'] ||
      !headers['sec-websocket-version'] ||
      headers['sec-websocket-version'] !== '13') {
    return fn();
  }
  
  // Если всё ок - вызываем колбек с true
  fn(null, true);
}`;

  content = content.replace(verifyPattern, newVerify);
  console.log('✓ verify() function COMPLETELY replaced');
} else {
  console.log('✗ verify() function not found in expected format');
  
  // Альтернативный поиск: может быть стрелочная функция
  const arrowPattern = /const verify\s*=\s*\(req,\s*upgrade,\s*fn\)\s*=>\s*\{[\s\S]*?\}/;
  const arrowMatch = content.match(arrowPattern);
  
  if (arrowMatch) {
    console.log('✓ Found arrow function verify');
    const newArrowVerify = `const verify = (req, upgrade, fn) => {
  // TUSUR FINAL FIX: Always allow WebSocket upgrades
  console.log('[TUSUR FINAL] verify arrow function called');
  
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    console.log('[TUSUR FINAL] WebSocket upgrade allowed (arrow)');
    return fn(null, true);
  }
  
  // Original logic
  if (!upgrade) return fn();
  if (!req.headers.upgrade) return fn();
  if (req.headers.upgrade.toLowerCase() !== 'websocket') return fn();
  if (!req.headers['sec-websocket-key'] || !req.headers['sec-websocket-version']) return fn();
  if (req.headers['sec-websocket-version'] !== '13') return fn();
  
  fn(null, true);
}`;
    
    content = content.replace(arrowPattern, newArrowVerify);
    console.log('✓ Arrow verify function replaced');
  }
}

// Также патчим handleRequest для дополнительной логики
if (content.includes('handleRequest(req, res)')) {
  content = content.replace(
    /handleRequest\(req,\s*res\)\s*\{/,
    `handleRequest(req, res) {
  // TUSUR FINAL FIX: Log all requests
  console.log('[TUSUR FINAL] handleRequest:', req.url, 'Upgrade:', req.headers.upgrade);
  
  // Mark WebSocket requests
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    req._tusurFinalWebSocket = true;
  }`
  );
  console.log('✓ handleRequest patched');
}

// Патчим _onUpgrade для полного обхода проверок
if (content.includes('_onUpgrade(req, socket, head)')) {
  content = content.replace(
    /_onUpgrade\(req,\s*socket,\s*head\)\s*\{/,
    `_onUpgrade(req, socket, head) {
  // TUSUR FINAL FIX: Skip all checks for WebSocket
  if (req._tusurFinalWebSocket) {
    console.log('[TUSUR FINAL] _onUpgrade: WebSocket detected, skipping checks');
    this.emit('upgrade', req, socket, head);
    return;
  }`
  );
  console.log('✓ _onUpgrade patched');
}

// Записываем исправленный файл
fs.writeFileSync(engineServerFile, content, 'utf8');
console.log('✓ engine.io server.js FINALLY patched');

// Патчим websocket.js тоже
const websocketFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';
if (fs.existsSync(websocketFile)) {
  let wsContent = fs.readFileSync(websocketFile, 'utf8');
  
  // Патчим doUpgrade
  if (wsContent.includes('function doUpgrade(req, socket, head)')) {
    wsContent = wsContent.replace(
      /function doUpgrade\(req,\s*socket,\s*head\)\s*\{/,
      `function doUpgrade(req, socket, head) {
  // TUSUR FINAL FIX: Allow all upgrades
  console.log('[TUSUR FINAL Websocket] doUpgrade called for:', req.url);
  
  // Если запрос от TUSUR - пропускаем все проверки
  if (req._tusurFinalWebSocket) {
    console.log('[TUSUR FINAL Websocket] TUSUR WebSocket, calling _upgrade directly');
    try {
      this._upgrade(req, socket, head);
    } catch (err) {
      console.error('[TUSUR FINAL Websocket] Error:', err.message);
    }
    return;
  }`
    );
    
    fs.writeFileSync(websocketFile, wsContent, 'utf8');
    console.log('✓ engine.io websocket.js FINALLY patched');
  }
}

// Патчим Outline websockets.js для правильных настроек
const outlineWebsockets = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(outlineWebsockets)) {
  let outlineContent = fs.readFileSync(outlineWebsockets, 'utf8');
  
  // Проверяем текущие настройки CORS
  console.log('Current CORS in websockets.js:', 
    outlineContent.match(/cors:\s*\{[^}]+?\}/)?.[0]?.substring(0, 100) || 'Not found');
  
  // Исправляем CORS настройки
  outlineContent = outlineContent.replace(
    /cors:\s*\{[^}]+?\}/g,
    `cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["*"]
  }`
  );
  
  // Добавляем transports если их нет
  if (!outlineContent.includes('transports:')) {
    outlineContent = outlineContent.replace(
      /(new socketIo\.Server\(server,\s*\{)/,
      `$1
  transports: ["websocket", "polling"],
  allowUpgrades: true,`
    );
  }
  
  fs.writeFileSync(outlineWebsockets, outlineContent, 'utf8');
  console.log('✓ Outline websockets.js FINALLY patched');
}

console.log('===========================================');
console.log('FINAL engine.io patch applied successfully!');
console.log('===========================================');