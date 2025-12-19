// websocket-token-patch.js
const fs = require('fs');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching WebSocket token handling...');

let code = fs.readFileSync(serverFile, 'utf8');

if (code.includes('WEBSOCKET_TOKEN_PATCH_APPLIED')) {
    console.log('WebSocket token patch already applied');
    process.exit(0);
}

const patch = `
// ======= WEBSOCKET TOKEN PATCH ========
console.log('WEBSOCKET_TOKEN_PATCH_APPLIED: Adding token extraction from cookies');

// Патчим обработку WebSocket соединений
const originalOnConnection = (io, socket) => {
    console.log('[WebSocket Patch] New connection attempt:', socket.id);
    
    // Извлекаем cookies из handshake
    const cookieHeader = socket.handshake.headers.cookie;
    console.log('[WebSocket Patch] Cookies:', cookieHeader ? 'present' : 'missing');
    
    if (cookieHeader) {
        // Парсим cookies для извлечения accessToken
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {});
        
        if (cookies.accessToken) {
            console.log('[WebSocket Patch] Found accessToken in cookies');
            // Добавляем токен в query параметры
            socket.handshake.query.accessToken = cookies.accessToken;
        } else {
            console.log('[WebSocket Patch] No accessToken in cookies');
        }
        
        // Также проверяем connect.sid
        if (cookies['connect.sid']) {
            socket.handshake.query.sessionId = cookies['connect.sid'].replace(/^s:/, '').split('.')[0];
        }
    }
    
    // Продолжаем стандартную обработку
    return originalOnConnection ? originalOnConnection(io, socket) : null;
};

// Находим и патчим создание WebSocket сервера
if (typeof app !== 'undefined' && app.createWebsocketServer) {
    const originalCreateWebsocketServer = app.createWebsocketServer;
    app.createWebsocketServer = function(server, services) {
        console.log('[WebSocket Patch] Creating patched WebSocket server');
        const io = originalCreateWebsocketServer.call(this, server, services);
        
        // Добавляем middleware для извлечения токена
        io.use((socket, next) => {
            console.log(\`[WebSocket Patch] Socket middleware for: \${socket.id}\`);
            
            // Извлекаем токен из query (теперь он там есть)
            const token = socket.handshake.query.accessToken;
            
            if (token) {
                console.log(\`[WebSocket Patch] Token found in query: \${token.substring(0, 20)}...\`);
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(token);
                    
                    if (decoded && decoded.id) {
                        socket.userId = decoded.id;
                        console.log(\`[WebSocket Patch] Authenticated user: \${decoded.id}\`);
                    }
                } catch (err) {
                    console.error('[WebSocket Patch] Error decoding token:', err.message);
                }
            } else {
                console.log('[WebSocket Patch] No token in query');
            }
            
            next();
        });
        
        return io;
    };
    
    console.log('[WebSocket Patch] WebSocket server patched successfully');
}
// ======= END WEBSOCKET TOKEN PATCH ========
`;

// Вставляем патч после TUSUR патчей
if (code.includes('TUSUR_PATCH_APPLIED')) {
    const insertPoint = code.indexOf('TUSUR_PATCH_APPLIED') + 100; // После TUSUR патча
    const patchedCode = code.slice(0, insertPoint) + '\n' + patch + code.slice(insertPoint);
    fs.writeFileSync(serverFile, patchedCode);
    console.log('WebSocket token patch applied successfully');
} else {
    // Добавляем в конец
    fs.writeFileSync(serverFile, code + '\n' + patch);
    console.log('WebSocket token patch appended to end of file');
}