// socket-io-auth-patch.js - исправленная версия
const fs = require('fs');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching Outline Socket.IO authentication...');

let code = fs.readFileSync(serverFile, 'utf8');

if (code.includes('TUSUR_SOCKETIO_PATCH_APPLIED')) {
    console.log('Socket.IO already patched');
    process.exit(0);
}

// Добавляем patch для Socket.IO аутентификации
const socketIoPatch = `
// ======= TUSUR SOCKETIO PATCH ========
console.log('TUSUR_SOCKETIO_PATCH_APPLIED: Adding WebSocket authentication');

if (typeof app !== 'undefined' && app.createWebsocketServer) {
    const originalCreateWebsocketServer = app.createWebsocketServer;
    app.createWebsocketServer = function(server, services) {
        console.log('[TUSUR Socket.IO] Creating websocket server with authentication');

        const io = originalCreateWebsocketServer.call(this, server, services);

        // Добавляем middleware для аутентификации
        io.use(async (socket, next) => {
            console.log(\`[TUSUR Socket.IO] New connection: \${socket.id}\`);

            // Получаем токен из query параметров
            const token = socket.handshake.query.accessToken;

            if (!token) {
                console.log('[TUSUR Socket.IO] No accessToken in query');
                // Пропускаем - Outline сам обработает
                return next();
            }

            console.log(\`[TUSUR Socket.IO] Token found: \${token.substring(0, 30)}...\`);

            try {
                // Валидируем токен
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);

                if (!decoded || !decoded.id) {
                    console.log('[TUSUR Socket.IO] Invalid token format');
                    return next(new Error('Authentication error'));
                }

                console.log(\`[TUSUR Socket.IO] Authenticated user: \${decoded.id}\`);

                // Прикрепляем данные пользователя к сокету
                socket.userId = decoded.id;
                socket.token = token;

                return next();

            } catch (error) {
                console.error('[TUSUR Socket.IO] Error during authentication:', error);
                return next(new Error('Authentication error'));
            }
        });

        return io;
    };
} else {
    console.log('[TUSUR Socket.IO] app.createWebsocketServer not found, skipping patch');
}
// ======= END TUSUR SOCKETIO PATCH ========
`;

// Ищем более надежный маркер для вставки
const patchMarker = 'TUSUR_PATCH_APPLIED';
if (code.includes(patchMarker)) {
    // Вставляем после TUSUR_PATCH_APPLIED
    const markerIndex = code.indexOf(patchMarker);
    const insertIndex = code.indexOf('\n', markerIndex) + 1;
    
    const patchedCode = code.slice(0, insertIndex) + socketIoPatch + code.slice(insertIndex);
    
    fs.writeFileSync(serverFile, patchedCode);
    console.log('Socket.IO authentication patch applied successfully');
} else {
    console.error('Cannot find TUSUR_PATCH_APPLIED marker in server file');
    process.exit(1);
}