// websocket-token-patch-fixed.js
const fs = require('fs');
const path = require('path');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching WebSocket token handling...');

let code = fs.readFileSync(serverFile, 'utf8');

if (code.includes('WEBSOCKET_TOKEN_PATCH_APPLIED_V2')) {
    console.log('WebSocket token patch already applied');
    process.exit(0);
}

// Найдем правильный путь к websockets
const websocketDir = '/opt/outline/build/server/websockets/index.js';
const websocketFile = path.join(websocketDir, 'index.js');

if (fs.existsSync(websocketFile)) {
    console.log('Found websocket file:', websocketFile);
    
    let wsCode = fs.readFileSync(websocketFile, 'utf8');
    
    // Проверяем, не патчили ли уже
    if (wsCode.includes('WEBSOCKET_TOKEN_PATCH_APPLIED_V2')) {
        console.log('WebSocket file already patched');
    } else {
        const wsPatch = `
// ======= WEBSOCKET TOKEN PATCH V2 ========
console.log('WEBSOCKET_TOKEN_PATCH_APPLIED_V2: Adding token extraction from cookies');

// Патчим обработку соединений
const originalHandleUpgrade = server.handleUpgrade;
if (originalHandleUpgrade) {
    server.handleUpgrade = function(request, socket, head) {
        // Извлекаем cookies из заголовков
        const cookieHeader = request.headers.cookie;
        if (cookieHeader) {
            // Парсим cookies
            const cookies = {};
            cookieHeader.split(';').forEach(cookie => {
                const parts = cookie.trim().split('=');
                if (parts.length === 2) {
                    cookies[parts[0]] = parts[1];
                }
            });
            
            // Добавляем accessToken к query параметрам
            if (cookies.accessToken) {
                const url = require('url');
                const parsedUrl = url.parse(request.url, true);
                parsedUrl.query.accessToken = cookies.accessToken;
                parsedUrl.search = null;
                request.url = url.format(parsedUrl);
                console.log('[WebSocket Patch] Added token to URL query');
            }
        }
        
        return originalHandleUpgrade.call(this, request, socket, head);
    };
    
    console.log('[WebSocket Patch] WebSocket server patched successfully');
}
// ======= END WEBSOCKET TOKEN PATCH V2 ========
`;
        
        // Вставляем патч в websocket файл
        if (wsCode.includes('module.exports =') || wsCode.includes('export default')) {
            const lines = wsCode.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('module.exports =') || lines[i].includes('export default')) {
                    lines.splice(i, 0, wsPatch);
                    break;
                }
            }
            wsCode = lines.join('\n');
        } else {
            wsCode += wsPatch;
        }
        
        fs.writeFileSync(websocketFile, wsCode);
        console.log('WebSocket file patched successfully');
    }
} else {
    console.log('WebSocket file not found, trying to patch main server file');
    
    // Альтернатива: патчим основной файл
    const mainPatch = `
// ======= WEBSOCKET TOKEN PATCH V2 ========
console.log('WEBSOCKET_TOKEN_PATCH_APPLIED_V2: Adding token extraction from cookies');

// Эта функция будет вызвана при инициализации WebSocket
setTimeout(() => {
    console.log('[WebSocket Patch V2] Initializing WebSocket token handling');
    
    // Патчим Socket.IO middleware если он есть
    if (global.io) {
        console.log('[WebSocket Patch V2] Found global.io, patching...');
        
        global.io.use((socket, next) => {
            console.log(\`[WebSocket Patch V2] Socket connection: \${socket.id}\`);
            
            // Проверяем cookies
            const cookieHeader = socket.handshake.headers.cookie;
            if (cookieHeader) {
                const cookies = {};
                cookieHeader.split(';').forEach(cookie => {
                    const parts = cookie.trim().split('=');
                    if (parts.length === 2) {
                        cookies[parts[0]] = parts[1];
                    }
                });
                
                // Добавляем токен из cookies в query
                if (cookies.accessToken && !socket.handshake.query.accessToken) {
                    socket.handshake.query.accessToken = cookies.accessToken;
                    console.log('[WebSocket Patch V2] Added token from cookies to query');
                }
            }
            
            next();
        });
    }
}, 2000);
// ======= END WEBSOCKET TOKEN PATCH V2 ========
`;
    
    // Добавляем патч в основной файл
    if (code.includes('TUSUR_PATCH_APPLIED')) {
        // Вставляем после TUSUR патча
        const tusurIndex = code.indexOf('TUSUR_PATCH_APPLIED');
        const insertIndex = code.indexOf('\n', tusurIndex) + 1;
        code = code.slice(0, insertIndex) + mainPatch + code.slice(insertIndex);
    } else {
        code += mainPatch;
    }
    
    fs.writeFileSync(serverFile, code);
    console.log('Main server file patched with WebSocket token handling');
}