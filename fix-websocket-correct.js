const fs = require('fs');

const file = '/opt/outline/build/server/services/websockets.js';
console.log('Fixing broken websockets.js...');

let code = fs.readFileSync(file, 'utf8');

// Удаляем дублирующиеся объявления
const lines = code.split('\n');
let inObject = false;
let braceCount = 0;
let newLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Проверяем, не испорчен ли файл
    if (line.includes('const io = new _socket.default.Server(server, {') && 
        lines[i+1] && lines[i+1].includes('path,')) {
        console.log('Found broken IO initialization at line', i);
        
        // Восстанавливаем правильную структуру
        newLines.push('  const path = "/realtime";');
        newLines.push('');
        newLines.push('  // Websockets for events and non-collaborative documents');
        newLines.push('  const io = new _socket.default.Server(server, {');
        newLines.push('    path,');
        newLines.push('    serveClient: false,');
        newLines.push('    cookie: false,');
        newLines.push('    pingInterval: 15000,');
        newLines.push('    pingTimeout: 30000,');
        newLines.push('    cors: {');
        newLines.push('      // Included for completeness, though CORS does not apply to websocket transport.');
        newLines.push('      origin: "*", // TUSUR: Allow all origins');
        newLines.push('      methods: ["GET", "POST"]');
        newLines.push('    }');
        newLines.push('  });');
        
        // Пропускаем сломанные строки
        i += 10; // Пропускаем сломанные строки
        continue;
    }
    
    newLines.push(line);
}

const fixedCode = newLines.join('\n');

// Сохраняем резервную копию
fs.writeFileSync(file + '.backup', code);
// Сохраняем исправленный файл
fs.writeFileSync(file, fixedCode);
console.log('File fixed');