// patch-engineio-websocket.js
const fs = require('fs');
const path = require('path');

console.log('Patching engine.io to allow direct WebSocket connections...');

// Ищем файлы engine.io
const possiblePaths = [
  '/opt/outline/node_modules/engine.io/build/transports/websocket.js',
  '/opt/outline/node_modules/engine.io/lib/transports/websocket.js',
  '/opt/outline/node_modules/socket.io/node_modules/engine.io/build/transports/websocket.js'
];

let patched = false;

for (const engineFile of possiblePaths) {
  if (fs.existsSync(engineFile)) {
    console.log('Found engine.io file:', engineFile);
    
    // Создаем backup
    const backupFile = engineFile + '.backup';
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(engineFile, backupFile);
      console.log('Created backup:', backupFile);
    }
    
    let code = fs.readFileSync(engineFile, 'utf8');
    
    // Ищем функцию onUpgrade или аналогичную проверку
    if (code.includes('function onUpgrade')) {
      // Отключаем проверку upgrade
      code = code.replace(
        /function onUpgrade\(req, socket\)\s*{[\s\S]*?return/,
        `function onUpgrade(req, socket) {
          console.log('[TUSUR Engine.IO] WebSocket upgrade requested:', req.url);
          // TUSUR: Always allow WebSocket upgrade
          return true;`
      );
      
      fs.writeFileSync(engineFile, code);
      console.log('Patched onUpgrade function');
      patched = true;
    }
    
    // Также ищем другие проверки
    if (code.includes('invalid transport upgrade')) {
      code = code.replace(
        /invalid transport upgrade/g,
        'TUSUR: transport upgrade allowed'
      );
      fs.writeFileSync(engineFile, code);
      console.log('Patched invalid transport upgrade message');
      patched = true;
    }
    
    break;
  }
}

if (!patched) {
  console.log('Trying to patch engine.io server file...');
  
  // Попробуем найти server.js
  const serverFiles = [
    '/opt/outline/node_modules/engine.io/build/server.js',
    '/opt/outline/node_modules/engine.io/lib/server.js'
  ];
  
  for (const serverFile of serverFiles) {
    if (fs.existsSync(serverFile)) {
      console.log('Found engine.io server file:', serverFile);
      let code = fs.readFileSync(serverFile, 'utf8');
      
      // Ищем middleware проверки
      if (code.includes('applyMiddleware')) {
        // Отключаем middleware для WebSocket
        code = code.replace(
          /applyMiddleware n°1/g,
          'applyMiddleware n°0 // TUSUR: No middleware for WebSocket'
        );
        
        fs.writeFileSync(serverFile, code);
        console.log('Patched applyMiddleware');
        patched = true;
      }
      break;
    }
  }
}

if (patched) {
  console.log('Engine.io patched successfully');
} else {
  console.log('Could not find engine.io files to patch');
}