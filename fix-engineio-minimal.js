const fs = require('fs');
const path = '/opt/outline/node_modules/engine.io/lib/server.js';

console.log('Применение минимального engine.io патча для TUSUR...');

const backupPath = path + '.backup';
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(path, backupPath);
  console.log('✓ Создана резервная копия');
}

let content = fs.readFileSync(path, 'utf8');

// ВАЖНО: Патчим ТОЛЬКО проверку заголовков, не добавляя middleware
if (!content.includes('// TUSUR FIX: Allow WebSocket upgrade')) {
  // Находим оригинальную проверку upgrade
  const pattern = /if\s*\(\s*!upgrade\s*\)\s*\{[\s\S]*?this\.handleUpgrade\(/g;
  
  if (content.match(pattern)) {
    // Упрощаем проверку - всегда разрешаем WebSocket если есть заголовок Upgrade
    content = content.replace(
      /if\s*\(\s*!upgrade\s*\)\s*\{[\s\S]*?this\.handleUpgrade\(/,
      `// TUSUR FIX: Allow WebSocket upgrade
      if (!upgrade && req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        upgrade = true;
      }
      if (!upgrade) {
        return this.handleUpgrade(`
    );
    
    fs.writeFileSync(path, content);
    console.log('✓ Применен минимальный патч для проверки заголовков');
  } else {
    console.log('✗ Не найдена оригинальная проверка upgrade');
  }
} else {
  console.log('✓ Патч уже применен');
}