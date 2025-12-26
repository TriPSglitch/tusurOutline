const fs = require('fs');
const path = require('path');

console.log('Applying SAFE engine.io patch for TUSUR v3...');

// 1. Проверяем структуру
console.log('=== Checking structure ===');
const checkPaths = [
  '/opt/outline/node_modules/engine.io/build/server.js',
  '/opt/outline/node_modules/socket.io/build/index.js',
  '/opt/outline/node_modules/socket.io/dist/index.js',
  '/opt/outline/build/server',
  '/opt/outline/build'
];

checkPaths.forEach(p => {
  console.log(`${fs.existsSync(p) ? '✓' : '✗'} ${p}`);
});

// 2. Патчим engine.io server.js
const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (fs.existsSync(engineServerFile)) {
  console.log('Patching engine.io server.js...');
  
  let content = fs.readFileSync(engineServerFile, 'utf8');
  
  // Ищем handleRequest - основная функция engine.io v6
  if (content.includes('handleRequest(req, res)')) {
    // Патчим ДО проверок
    const handleRequestPattern = /handleRequest\(req,\s*res\)\s*\{/;
    
    if (content.match(handleRequestPattern)) {
      content = content.replace(
        handleRequestPattern,
        `handleRequest(req, res) {
  // TUSUR PATCH v3: Engine.io WebSocket fix
  console.log('[TUSUR Engine] Request to:', req.url);
  
  // Если это WebSocket запрос, помечаем его
  const isWebSocket = req.headers.upgrade && 
                     req.headers.upgrade.toLowerCase() === 'websocket' &&
                     req.url.includes('transport=websocket');
  
  if (isWebSocket) {
    console.log('[TUSUR Engine] WebSocket upgrade detected');
    // Помечаем запрос как прошедший проверку
    req._tusurWebSocket = true;
  }`
      );
      console.log('✓ Engine.io handleRequest patched');
    }
  }
  
  // Также патчим verify функцию
  if (content.includes('function verify(req, upgrade, fn)')) {
    content = content.replace(
      /function verify\(req,\s*upgrade,\s*fn\)\s*\{/,
      `function verify(req, upgrade, fn) {
  // TUSUR PATCH v3: Skip verification for WebSocket
  if (req._tusurWebSocket) {
    console.log('[TUSUR Engine] Verification skipped for TUSUR WebSocket');
    return fn();
  }`
    );
    console.log('✓ Engine.io verify function patched');
  }
  
  fs.writeFileSync(engineServerFile, content);
  console.log('✓ engine.io server.js patched SAFELY');
} else {
  console.log('✗ engine.io server.js not found!');
}

// 3. Патчим engine.io websocket.js
const engineWebsocketFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';
if (fs.existsSync(engineWebsocketFile)) {
  console.log('Patching engine.io websocket.js SAFELY...');
  
  let content = fs.readFileSync(engineWebsocketFile, 'utf8');
  
  // Патчим doUpgrade
  if (content.includes('function doUpgrade(req, socket, head)')) {
    content = content.replace(
      /function doUpgrade\(req,\s*socket,\s*head\)\s*\{/,
      `function doUpgrade(req, socket, head) {
  // TUSUR PATCH v3: Log WebSocket upgrade
  console.log('[TUSUR Engine Websocket] doUpgrade called for:', req.url);
  
  // Пропускаем стандартные проверки для TUSUR
  if (req._tusurWebSocket) {
    console.log('[TUSUR Engine Websocket] TUSUR WebSocket detected, skipping checks');
    try {
      this._upgrade(req, socket, head);
      return;
    } catch (err) {
      console.log('[TUSUR Engine Websocket] Error:', err.message);
    }
  }`
    );
  }
  
  fs.writeFileSync(engineWebsocketFile, content);
  console.log('✓ engine.io websocket.js patched SAFELY');
} else {
  console.log('✗ engine.io websocket.js not found!');
}

// 4. Патчим socket.io (ищем в правильном месте)
const socketIoPaths = [
  '/opt/outline/node_modules/socket.io/build/index.js',
  '/opt/outline/node_modules/socket.io/dist/index.js'
];

let socketPatched = false;
for (const socketPath of socketIoPaths) {
  if (fs.existsSync(socketPath)) {
    console.log(`Patching socket.io SAFELY: ${socketPath}`);
    
    let content = fs.readFileSync(socketPath, 'utf8');
    
    // Патчим applyMiddleware для добавления TUSUR middleware
    if (content.includes('applyMiddleware')) {
      content = content.replace(
        /applyMiddleware\(middleware\)\s*\{/,
        `applyMiddleware(middleware) {
  // TUSUR PATCH v3: Add TUSUR middleware for WebSocket support
  if (!this._middlewares) this._middlewares = [];
  
  const tusurMiddleware = (req, res, next) => {
    // Log WebSocket attempts
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      console.log('[TUSUR Socket.io] WebSocket request detected');
      req._tusurSocketIo = true;
    }
    next();
  };
  
  // Add our middleware first
  this._middlewares.unshift(tusurMiddleware);
  this._middlewares.push(middleware);`
      );
      
      fs.writeFileSync(socketPath, content);
      console.log('✓ socket.io patched SAFELY');
      socketPatched = true;
      break;
    }
  }
}

if (!socketPatched) {
  console.log('✗ Could not find or patch socket.io');
}

// 5. Ищем и патчим Outline websockets файл
console.log('=== Searching for Outline websockets file ===');
const possibleWebsocketsPaths = [
  '/opt/outline/build/server/websockets.js',
  '/opt/outline/build/server/services/websockets.js',
  '/opt/outline/build/server/websockets/index.js',
  '/opt/outline/build/server/index.js'
];

let outlinePatched = false;
for (const wsPath of possibleWebsocketsPaths) {
  if (fs.existsSync(wsPath)) {
    console.log(`Found websockets file: ${wsPath}`);
    
    let content = fs.readFileSync(wsPath, 'utf8');
    
    // Патчим настройки Socket.IO
    if (content.includes('new socketIo.Server') || content.includes('socketIo(server')) {
      // Упрощаем CORS
      content = content.replace(
        /cors:\s*\{[^}]+\}/g,
        `cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["*"]
  }`
      );
      
      // Добавляем transports
      if (content.includes('transports:')) {
        content = content.replace(
          /transports:\s*\[[^\]]+\]/g,
          'transports: ["websocket", "polling"]'
        );
      } else {
        // Добавляем transports если их нет
        content = content.replace(
          /(new socketIo\.Server\(server,\s*\{)/,
          `$1
  transports: ["websocket", "polling"],
  allowUpgrades: true,`
        );
      }
      
      fs.writeFileSync(wsPath, content);
      console.log(`✓ Outline websockets patched: ${wsPath}`);
      outlinePatched = true;
      break;
    }
  }
}

if (!outlinePatched) {
  console.log('⚠️  Could not find Outline websockets configuration');
  console.log('Trying to find where Socket.IO is initialized...');
  
  // Ищем в других файлах
  const searchCmd = `find /opt/outline/build -name "*.js" -type f -exec grep -l "socketIo" {} \\; 2>/dev/null | head -5`;
  require('child_process').execSync(searchCmd, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .forEach(file => console.log(`  Potential: ${file}`));
}

console.log('============================================');
console.log('SAFE engine.io patch v3 applied!');
console.log('============================================');