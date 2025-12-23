// patch-websocket-origin.js - ТОЛЬКО отключаем проверку origin
const fs = require('fs');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Checking WebSocket file:', websocketFile);

if (!fs.existsSync(websocketFile)) {
    console.log('WebSocket file not found, skipping origin patch');
    process.exit(0);
}

let code = fs.readFileSync(websocketFile, 'utf8');

// Ищем проверку origin
if (code.includes('req.headers.origin') && code.includes('URL.startsWith')) {
    console.log('Found origin check, disabling it...');
    
    // Заменяем проверку на true
    code = code.replace(
        /if\s*\(\s*!.*req\.headers\.origin.*\)/g,
        'if (false) // TUSUR: Origin check disabled'
    );
    
    fs.writeFileSync(websocketFile, code);
    console.log('Origin check disabled');
} else {
    console.log('No origin check found');
}