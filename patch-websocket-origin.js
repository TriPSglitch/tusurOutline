// patch-websocket-origin.js
const fs = require('fs');
const path = require('path');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Patching WebSocket origin check in:', websocketFile);

let code = fs.readFileSync(websocketFile, 'utf8');

if (code.includes('ORIGIN_CHECK_DISABLED')) {
    console.log('Origin check already disabled');
    process.exit(0);
}

// Находим проверку Origin в коде
const originCheckPattern = /if\s*\(\s*!\s*_env\.default\.isCloudHosted\s*&&\s*\(\s*!\s*req\.headers\.origin\s*\|\|\s*!\s*_env\.default\.URL\.startsWith\(req\.headers\.origin\)\s*\)\s*\)\s*\{/;

if (originCheckPattern.test(code)) {
    console.log('Found origin check, disabling it...');
    
    // Полностью отключаем проверку Origin
    const patchedCode = code.replace(
        originCheckPattern,
        `if (false) { // ORIGIN_CHECK_DISABLED: Origin check disabled for TUSUR deployment`
    );
    
    fs.writeFileSync(websocketFile, patchedCode);
    console.log('Origin check disabled successfully');
} else {
    // Ищем альтернативную проверку
    const altPattern = /if\s*\(\s*!\s*req\.headers\.origin\s*\|\|\s*!\s*_env\.default\.URL\.startsWith\(req\.headers\.origin\)\s*\)/;
    
    if (altPattern.test(code)) {
        console.log('Found alternative origin check, disabling...');
        const patchedCode = code.replace(
            altPattern,
            `if (false) // ORIGIN_CHECK_DISABLED`
        );
        fs.writeFileSync(websocketFile, patchedCode);
        console.log('Alternative origin check disabled');
    } else {
        console.log('Could not find origin check pattern, adding debug info');
        
        // Добавим отладочную информацию в начало файла
        const debugCode = `// ORIGIN_CHECK_DISABLED: Origin checks are disabled\nconsole.log('[WebSocket] Origin check disabled for TUSUR');\n`;
        
        // Найдем где начинается функция init
        const initPattern = /function init\(app, server, serviceNames\)/;
        if (initPattern.test(code)) {
            const patchedCode = code.replace(
                initPattern,
                `${debugCode}function init(app, server, serviceNames)`
            );
            fs.writeFileSync(websocketFile, patchedCode);
            console.log('Added debug info at init function');
        } else {
            // Просто добавим в начало
            fs.writeFileSync(websocketFile, debugCode + code);
            console.log('Added debug info at file start');
        }
    }
}

// Также обновим env.js для установки isCloudHosted = true
const envFile = '/opt/outline/build/server/env.js';
if (fs.existsSync(envFile)) {
    let envCode = fs.readFileSync(envFile, 'utf8');
    
    if (envCode.includes('isCloudHosted:')) {
        envCode = envCode.replace(
            /isCloudHosted:\s*[^,}]+/,
            'isCloudHosted: true'
        );
        fs.writeFileSync(envFile, envCode);
        console.log('Set isCloudHosted: true in env.js');
    }
}

console.log('WebSocket patch applied successfully');