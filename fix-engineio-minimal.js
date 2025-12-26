const fs = require('fs');
const path = require('path');

console.log('Применение минимального engine.io патча для TUSUR...');

const serverPath = '/opt/outline/node_modules/engine.io/build/server.js';
console.log('Путь к server.js:', serverPath);

if (!fs.existsSync(serverPath)) {
  console.error('❌ Файл server.js не найден!');
  console.error('Доступные файлы в engine.io:');
  const enginePath = '/opt/outline/node_modules/engine.io';
  if (fs.existsSync(enginePath)) {
    const files = fs.readdirSync(enginePath, { withFileTypes: true });
    files.forEach(f => console.log('  ', f.name, f.isDirectory() ? '(dir)' : ''));
  }
  process.exit(1);
}

const backupPath = serverPath + '.backup';
if (!fs.existsSync(backupPath)) {
  try {
    fs.copyFileSync(serverPath, backupPath);
    console.log('✓ Создана резервная копия:', backupPath);
  } catch (err) {
    console.error('❌ Ошибка создания бэкапа:', err.message);
  }
}

let content = fs.readFileSync(serverPath, 'utf8');

// Проверяем, не патчен ли уже файл
if (!content.includes('TUSUR FIX')) {
  console.log('✓ Исходный файл найден, длина:', content.length);
  
  // Патчим проверку заголовков Upgrade
  // В engine.io v6 структура другая, ищем handleRequest
  if (content.includes('handleRequest(req, res)')) {
    // Простой патч: добавляем проверку заголовков
    const searchPattern = /(handleRequest\(req,\s*res\)\s*\{)/;
    
    if (content.match(searchPattern)) {
      content = content.replace(
        searchPattern,
        `$1
    // TUSUR FIX: Always allow WebSocket upgrade
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      req._upgraded = true;
    }`
      );
      
      fs.writeFileSync(serverPath, content, 'utf8');
      console.log('✓ Engine.io v6 успешно пропатчен');
    } else {
      console.error('❌ Не найдена функция handleRequest в ожидаемом формате');
    }
  } 
  // Альтернативный поиск для более старых версий
  else if (content.includes('if (!upgrade)')) {
    content = content.replace(
      /if\s*\(\s*!upgrade\s*\)\s*\{/,
      `// TUSUR FIX: Allow WebSocket upgrade
    if (!upgrade && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
      upgrade = true;
    }
    if (!upgrade) {`
    );
    
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✓ Engine.io успешно пропатчен (старый формат)');
  }
  else {
    console.error('❌ Не найдены знакомые паттерны в engine.io');
    console.log('Первые 500 символов файла:');
    console.log(content.substring(0, 500));
  }
} else {
  console.log('✓ Патч уже применен ранее');
}

// Дополнительно: проверяем socket.io настройки
const socketIoPath = '/opt/outline/node_modules/socket.io/build/index.js';
if (fs.existsSync(socketIoPath)) {
  console.log('Проверка socket.io...');
  let socketContent = fs.readFileSync(socketIoPath, 'utf8');
  
  if (socketContent.includes('cors:')) {
    console.log('✓ Socket.io использует CORS настройки');
  }
}