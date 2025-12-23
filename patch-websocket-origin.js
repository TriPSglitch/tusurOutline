const fs = require('fs');
const path = require('path');

console.log('=== Applying CORRECT TUSUR WebSocket fix ===');

const file = '/opt/outline/build/server/services/websockets.js';
if (!fs.existsSync(file)) {
    console.error('File not found:', file);
    process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

// Создаем резервную копию ПЕРЕД изменениями
fs.writeFileSync(file + '.backup-pre', code);

// ===== ТОЛЬКО НЕОБХОДИМЫЕ ИЗМЕНЕНИЯ =====

// 1. Отключаем проверку origin (самая важная)
const originCheck = /if \(!_env\.default\.isCloudHosted && \(!req\.headers\.origin \|\| !_env\.default\.URL\.startsWith\(req\.headers\.origin\)\)\)/g;
if (originCheck.test(code)) {
    code = code.replace(originCheck, 'if (false) // TUSUR: Origin check disabled');
    console.log('1. Origin check disabled ✓');
} else {
    console.log('1. Origin check pattern not found');
}

// 2. Разрешаем все origins в CORS
const corsOrigin = /origin: _env\.default\.isCloudHosted \? "[^"]+" : _env\.default\.URL/g;
if (corsOrigin.test(code)) {
    code = code.replace(corsOrigin, 'origin: "*" // TUSUR: Allow all origins');
    console.log('2. CORS origin set to * ✓');
} else {
    console.log('2. CORS origin pattern not found');
}

// 3. Безопасно добавляем поддержку EIO3/EIO4
// Найдем создание io сервера более безопасным способом
const ioPattern = /const io = new _socket\.default\.Server\(server, \{/;
if (ioPattern.test(code)) {
    // Найдем позицию
    const ioIndex = code.indexOf('const io = new _socket.default.Server(server, {');
    if (ioIndex !== -1) {
        // Найдем закрывающую скобку этого объекта
        let braceCount = 0;
        let endIndex = ioIndex;
        let found = false;
        
        for (let i = ioIndex; i < code.length; i++) {
            if (code[i] === '{') braceCount++;
            if (code[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i;
                    found = true;
                    break;
                }
            }
        }
        
        if (found) {
            const ioConfig = code.substring(ioIndex, endIndex + 1);
            
            // Проверяем, есть ли уже allowEIO3/allowEIO4
            if (!ioConfig.includes('allowEIO3') && !ioConfig.includes('allowEIO4')) {
                // Добавляем перед закрывающей скобкой
                const newIoConfig = ioConfig.replace(/\s*\}$/, ',\n    allowEIO3: true,\n    allowEIO4: true\n  }');
                code = code.substring(0, ioIndex) + newIoConfig + code.substring(endIndex + 1);
                console.log('3. Added EIO3/EIO4 support ✓');
            } else {
                console.log('3. EIO3/EIO4 already present');
            }
        } else {
            console.log('3. Could not find end of io config object');
        }
    }
}

// Сохраняем исправленный файл
fs.writeFileSync(file, code);

// Проверяем синтаксис
console.log('\n=== Syntax check ===');
try {
    require('vm').createScript(code, file);
    console.log('Syntax: OK ✓');
} catch (error) {
    console.error('Syntax error:', error.message);
    console.log('Line where error occurred:', error.stack.match(/websockets\.js:(\d+)/)?.[1] || 'unknown');
    
    // Восстанавливаем из резервной копии
    if (fs.existsSync(file + '.backup-pre')) {
        console.log('Restoring from backup...');
        const backup = fs.readFileSync(file + '.backup-pre', 'utf8');
        fs.writeFileSync(file, backup);
        console.log('Restored original file');
    }
}

console.log('=== WebSocket fix completed ===');