const fs = require('fs');
const path = require('path');

console.log('Fixing engine.io CORS settings...');

// 1. Находим все возможные файлы engine.io
const enginePaths = [
  '/opt/outline/node_modules/engine.io/build/engine.io.js',
  '/opt/outline/node_modules/engine.io/lib/engine.io.js',
  '/opt/outline/node_modules/engine.io/build/server.js'
];

enginePaths.forEach(enginePath => {
  if (fs.existsSync(enginePath)) {
    console.log(`Patching ${enginePath}...`);
    let content = fs.readFileSync(enginePath, 'utf8');
    
    // Заменяем все CORS ограничения
    content = content.replace(
      /cors:\s*\{[^}]*\}/g,
      `cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["*"],
        credentials: true
      }`
    );
    
    fs.writeFileSync(enginePath, content);
    console.log(`✓ ${enginePath} patched`);
  }
});

// 2. Патчим Socket.IO CORS
const socketPaths = [
  '/opt/outline/node_modules/socket.io/dist/index.js',
  '/opt/outline/node_modules/socket.io/build/index.js'
];

socketPaths.forEach(socketPath => {
  if (fs.existsSync(socketPath)) {
    console.log(`Patching ${socketPath}...`);
    let content = fs.readFileSync(socketPath, 'utf8');
    
    // Ищем и заменяем CORS настройки
    content = content.replace(
      /cors:\s*\{[^}]*\}/g,
      `cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["*"],
        credentials: true
      }`
    );
    
    fs.writeFileSync(socketPath, content);
    console.log(`✓ ${socketPath} patched`);
  }
});

console.log('CORS fixes applied!');