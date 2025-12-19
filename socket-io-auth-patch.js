// socket-io-auth-patch.js - исправленная версия
const fs = require('fs');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching Outline Socket.IO authentication...');

let code = fs.readFileSync(serverFile, 'utf8');

if (code.includes('TUSUR_SOCKETIO_PATCH_APPLIED')) {
    console.log('Socket.IO already patched');
    process.exit(0);
}

// Проверяем, есть ли основной патч
if (!code.includes('TUSUR_PATCH_APPLIED')) {
    console.error('ERROR: TUSUR_PATCH_APPLIED not found. Apply patch-server.js first!');
    process.exit(1);
}

// Добавляем patch для Socket.IO аутентификации
const socketIoPatch = `
// ======= TUSUR SOCKETIO PATCH ========
console.log('TUSUR_SOCKETIO_PATCH_APPLIED: Adding WebSocket authentication');

// Проверяем, существует ли app.createWebsocketServer
if (typeof app !== 'undefined' && app.createWebsocketServer) {
    console.log('[TUSUR Socket.IO] Found app.createWebsocketServer, patching...');
    
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

// Вставляем patch в правильное место - после активации плагина
const marker = "console.log('TUSUR plugin activated successfully');";
if (code.includes(marker)) {
    const markerIndex = code.indexOf(marker);
    const insertIndex = markerIndex + marker.length;
    
    const patchedCode = code.slice(0, insertIndex) + '\n' + socketIoPatch + code.slice(insertIndex);
    
    fs.writeFileSync(serverFile, patchedCode);
    console.log('Socket.IO authentication patch applied successfully');
} else {
    // Пробуем найти альтернативный маркер
    console.log('Looking for alternative marker...');
    
    // Ищем любую строку с TUSUR plugin activated
    const altMarker = "TUSUR plugin activated";
    if (code.includes(altMarker)) {
        const markerLine = code.split('\n').find(line => line.includes(altMarker));
        if (markerLine) {
            const markerIndex = code.indexOf(markerLine);
            const insertIndex = markerIndex + markerLine.length;
            
            const patchedCode = code.slice(0, insertIndex) + '\n' + socketIoPatch + code.slice(insertIndex);
            
            fs.writeFileSync(serverFile, patchedCode);
            console.log('Socket.IO authentication patch applied using alternative marker');
        } else {
            console.error('Cannot find activation marker');
            process.exit(1);
        }
    } else {
        // Добавляем в конец файла
        console.log('Adding Socket.IO patch to end of file');
        fs.writeFileSync(serverFile, code + '\n' + socketIoPatch);
    }
}

// Проверяем результат
const finalCode = fs.readFileSync(serverFile, 'utf8');
if (finalCode.includes('TUSUR_SOCKETIO_PATCH_APPLIED')) {
    console.log('Socket.IO patch successfully applied');
} else {
    console.error('Failed to apply Socket.IO patch');
    process.exit(1);
}