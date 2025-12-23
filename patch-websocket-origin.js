// patch-websocket-origin.js - ТОЛЬКО отключаем проверку origin
const fs = require('fs');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Checking WebSocket file:', websocketFile);

if (!fs.existsSync(websocketFile)) {
    console.log('WebSocket file not found, skipping origin patch');
    process.exit(0);
}

let code = fs.readFileSync(websocketFile, 'utf8');

// Проверяем, есть ли уже наш патч
if (code.includes('TUSUR: Origin check disabled')) {
    console.log('Origin check already disabled');
    process.exit(0);
}

// Ищем проверку origin - более конкретный паттерн
const originCheckPattern = /if\s*\(\s*!.*req\.headers\.origin.*startsWith.*/g;

if (originCheckPattern.test(code)) {
    console.log('Found origin check, disabling it...');
    
    // Восстанавливаем исходный код для поиска
    code = fs.readFileSync(websocketFile, 'utf8');
    
    // Более безопасная замена - находим весь блок проверки origin
    const lines = code.split('\n');
    let inOriginCheck = false;
    let startLine = -1;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('req.headers.origin') && lines[i].includes('startsWith')) {
            // Находим начало if
            for (let j = i; j >= 0; j--) {
                if (lines[j].trim().startsWith('if')) {
                    startLine = j;
                    inOriginCheck = true;
                    break;
                }
            }
        }
        
        if (inOriginCheck) {
            // Считаем фигурные скобки
            braceCount += (lines[i].match(/{/g) || []).length;
            braceCount -= (lines[i].match(/}/g) || []).length;
            
            // Заменяем условие
            if (lines[i].trim().startsWith('if')) {
                lines[i] = 'if (false) { // TUSUR: Origin check disabled';
            }
            
            // Если мы вышли из блока
            if (braceCount === 0 && i > startLine) {
                inOriginCheck = false;
            }
        }
    }
    
    code = lines.join('\n');
    fs.writeFileSync(websocketFile, code);
    console.log('Origin check disabled');
} else {
    console.log('No origin check found, trying alternative pattern...');
    
    // Альтернативный паттерн для Outline
    const altPattern = /if\s*\(\s*origin\s*&&\s*!origin\.startsWith/;
    if (altPattern.test(code)) {
        console.log('Found alternative origin check, disabling it...');
        
        code = code.replace(
            /if\s*\(\s*origin\s*&&\s*!origin\.startsWith\(/g,
            'if (false && origin && !origin.startsWith('
        );
        
        fs.writeFileSync(websocketFile, code);
        console.log('Alternative origin check disabled');
    } else {
        console.log('No origin check patterns found');
    }
}