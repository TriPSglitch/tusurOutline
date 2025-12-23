const fs = require('fs');
const path = require('path');

console.log('=== Applying CORRECT TUSUR WebSocket fix ===');

const file = '/opt/outline/build/server/services/websockets.js';
if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

// Проверяем, не сломан ли уже файл
if (code.includes('Unexpected identifier') || code.includes('SyntaxError')) {
    console.log('File appears to be broken, restoring from backup...');
    const backup = file + '.backup';
    if (fs.existsSync(backup)) {
        code = fs.readFileSync(backup, 'utf8');
        console.log('Restored from backup');
    } else {
        console.error('No backup found, need original file');
        process.exit(1);
    }
}

// ===== ТОЛЬКО НЕОБХОДИМЫЕ ИЗМЕНЕНИЯ =====
// 1. Отключаем проверку origin (самая важная)
code = code.replace(
    /if \(!_env\.default\.isCloudHosted && \(!req\.headers\.origin \|\| !_env\.default\.URL\.startsWith\(req\.headers\.origin\)\)\)/g,
    'if (false) // TUSUR: Origin check disabled'
);

// 2. Разрешаем все origins в CORS
code = code.replace(
    /origin: _env\.default\.isCloudHosted \? "[^"]+" : _env\.default\.URL/g,
    'origin: "*" // TUSUR: Allow all origins'
);

// 3. Добавляем поддержку EIO4
const ioServerMatch = code.match(/const io = new _socket\.default\.Server\(server, \{[\s\S]*?\}\);/);
if (ioServerMatch) {
    const ioInit = ioServerMatch[0];
    if (!ioInit.includes('allowEIO3') && !ioInit.includes('allowEIO4')) {
        const fixedIoInit = ioInit.replace(
            /,\s*cors: \{[\s\S]*?\}\s*\}/,
            `,\n    cors: {\n      origin: "*",\n      methods: ["GET", "POST"]\n    },\n    allowEIO3: true,\n    allowEIO4: true\n  }`
        );
        code = code.replace(ioInit, fixedIoInit);
        console.log('Added EIO3/EIO4 support');
    }
}

// Сохраняем резервную копию
fs.writeFileSync(file + '.backup', code);

// Сохраняем исправленный файл
fs.writeFileSync(file, code);
console.log('=== WebSocket fix applied successfully ===');