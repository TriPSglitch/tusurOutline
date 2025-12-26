const fs = require('fs');
const path = require('path');

console.log('Применение минимального engine.io патча для TUSUR...');

// Проверяем наличие engine.io
const engineIoPath = '/opt/outline/node_modules/engine.io';
if (!fs.existsSync(engineIoPath)) {
  console.error('❌ engine.io не установлен!');
  console.error('Запустите: npm install engine.io в /opt/outline');
  process.exit(1);
}

const serverJsPath = path.join(engineIoPath, 'lib/server.js');
console.log('Путь к server.js:', serverJsPath);

if (!fs.existsSync(serverJsPath)) {
  console.error('❌ Файл server.js не найден в engine.io');
  console.error('Проверьте установку engine.io');
  process.exit(1);
}

const backupPath = serverJsPath + '.backup';
if (!fs.existsSync(backupPath)) {
  try {
    fs.copyFileSync(serverJsPath, backupPath);
    console.log('✓ Создана резервная копия');
  } catch (err) {
    console.error('❌ Ошибка создания бэкапа:', err.message);
  }
}

let content = fs.readFileSync(serverJsPath, 'utf8');

// Проверяем, не патчен ли уже файл
if (!content.includes('TUSUR FIX')) {
  // Патчим проверку заголовков Upgrade
  const searchPattern = /if\s*\(\s*!upgrade\s*\)\s*\{[\s\S]*?this\.handleUpgrade\(/;
  const matches = content.match(searchPattern);
  
  if (matches) {
    console.log('✓ Найдена оригинальная проверка upgrade');
    
    content = content.replace(
      searchPattern,
      `// TUSUR FIX: Allow WebSocket upgrade
      if (!upgrade && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        upgrade = true;
      }
      if (!upgrade) {
        return this.handleUpgrade(`
    );
    
    try {
      fs.writeFileSync(serverJsPath, content, 'utf8');
      console.log('✓ Патч успешно применен');
      
      // Проверяем результат
      const newContent = fs.readFileSync(serverJsPath, 'utf8');
      if (newContent.includes('TUSUR FIX')) {
        console.log('✓ Проверка: патч присутствует в файле');
      }
    } catch (err) {
      console.error('❌ Ошибка записи файла:', err.message);
    }
  } else {
    console.error('❌ Не найдена проверка upgrade в файле');
    console.log('Содержимое первых 500 символов:', content.substring(0, 500));
  }
} else {
  console.log('✓ Патч уже применен ранее');
}