const fs = require('fs');

console.log('Fixing broken socket.io file...');

const brokenFile = '/opt/outline/node_modules/socket.io/dist/index.js';
if (fs.existsSync(brokenFile)) {
  console.log('Restoring socket.io from backup or original...');

  // Вариант 1: Восстановить из backup
  const backupFile = brokenFile + '.backup';
  if (fs.existsSync(backupFile)) {
    fs.copyFileSync(backupFile, brokenFile);
    console.log('✓ Restored from backup');
  } else {
    // Вариант 2: Исправить синтаксис
    let code = fs.readFileSync(brokenFile, 'utf8');

    // Исправляем сломанную строку
    code = code.replace(
      /this\._\/\/ TUSUR: corsMiddleware disabled\(req, res, \(\) => {/g,
      'this._corsMiddleware(req, res, () => {'
    );

    fs.writeFileSync(brokenFile, code);
    console.log('✓ Fixed syntax error');
  }
}

console.log('Socket.io file fixed');