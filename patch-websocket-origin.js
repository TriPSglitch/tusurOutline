const fs = require('fs');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Patching Outline WebSocket file:', websocketFile);

if (!fs.existsSync(websocketFile)) {
    console.error('WebSocket file not found:', websocketFile);
    process.exit(1);
}

let code = fs.readFileSync(websocketFile, 'utf8');

// Проверяем, не патчили ли уже
if (code.includes('TUSUR_WEBSOCKET_FIX_APPLIED')) {
    console.log('Already patched');
    process.exit(0);
}

// Находим функцию init
const initFunctionMatch = code.match(/function init\([^)]*\)[^{]*{/);
if (!initFunctionMatch) {
    console.error('Could not find init function');
    process.exit(1);
}

console.log('Found init function, patching...');

// Добавляем middleware для обработки токенов из cookies
const patchMiddleware = `
// ======= TUSUR WEBSOCKET FIX ========
console.log('TUSUR_WEBSOCKET_FIX_APPLIED: Adding token extraction for TUSUR');

// Добавляем middleware для извлечения токена из cookies
io.use((socket, next) => {
    console.log(\`[TUSUR WebSocket] Connection attempt: \${socket.id}\`);
    
    // 1. Проверяем токен в query (основной способ для клиента)
    let token = socket.handshake.query.accessToken || 
               socket.handshake.query.token;
    
    // 2. Если нет в query, проверяем cookies (для WebSocket из браузера)
    if (!token && socket.handshake.headers.cookie) {
        console.log('[TUSUR WebSocket] Checking cookies for token');
        const cookies = {};
        socket.handshake.headers.cookie.split(';').forEach(cookie => {
            const parts = cookie.trim().split('=');
            if (parts.length === 2) {
                cookies[parts[0]] = parts[1];
            }
        });
        
        token = cookies.accessToken || cookies.token;
        
        if (token) {
            console.log('[TUSUR WebSocket] Found token in cookies, adding to query');
            // Добавляем токен в query для совместимости с Outline
            socket.handshake.query.accessToken = token;
        }
    }
    
    console.log(\`[TUSUR WebSocket] Token found: \${token ? 'YES (' + token.substring(0, 20) + '...)' : 'NO'}\`);
    
    if (token) {
        try {
            // Декодируем токен для получения user ID
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            
            if (decoded && decoded.id) {
                socket.userId = decoded.id;
                console.log(\`[TUSUR WebSocket] User authenticated: \${decoded.id}\`);
                
                // Также устанавливаем для совместимости с Outline
                socket.handshake.auth = socket.handshake.auth || {};
                socket.handshake.auth.userId = decoded.id;
                socket.handshake.auth.token = token;
            }
        } catch (error) {
            console.log('[TUSUR WebSocket] Token decode error:', error.message);
        }
    }
    
    next(); // Разрешаем соединение
});
// ======= END TUSUR WEBSOCKET FIX ========
`;

// Ищем место, где добавляются middleware (после создания io)
const ioCreationPattern = /const io = createWebsocketServer\(server, services\);/;
if (ioCreationPattern.test(code)) {
    // Вставляем после создания io
    code = code.replace(
        ioCreationPattern,
        `const io = createWebsocketServer(server, services);\n${patchMiddleware}`
    );
    console.log('Patched after io creation');
} else {
    // Ищем место после socket.io server creation
    const socketIoPattern = /io\.on\(['"]connection['"]/;
    if (socketIoPattern.test(code)) {
        // Вставляем перед обработкой connection
        code = code.replace(
            socketIoPattern,
            `${patchMiddleware}\n\n    io.on('connection'`
        );
        console.log('Patched before connection handler');
    } else {
        // Добавляем в конец функции
        const initEndPattern = /return io;\s*}$/;
        if (initEndPattern.test(code)) {
            code = code.replace(
                initEndPattern,
                `${patchMiddleware}\n\n    return io;\n}`
            );
            console.log('Patched before return statement');
        } else {
            console.error('Could not find insertion point');
            process.exit(1);
        }
    }
}

// Также отключаем проверку origin если есть
code = code.replace(
    /if \(!req\.headers\.origin \|\| !env\.URL\.startsWith\(req\.headers\.origin\)\)/g,
    'if (false) // TUSUR: Origin check disabled'
);

fs.writeFileSync(websocketFile, code);
console.log('WebSocket patched successfully');