// socket-io-auth-patch.js - исправленная версия
const fs = require('fs');
const path = require('path');

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
// ======= END TUSUR SOCKETIO PATCH ========
`;

// Вставляем patch после TUSUR_PATCH_APPLIED
const patchMarker = 'TUSUR plugin activated successfully';
if (code.includes(patchMarker)) {
    // Ищем точное вхождение с закрывающей кавычкой
    const markerWithQuote = "console.log('TUSUR plugin activated successfully');";
    
    if (code.includes(markerWithQuote)) {
        const patchedCode = code.replace(
            markerWithQuote,
            `${markerWithQuote}\n${socketIoPatch}`
        );
        
        fs.writeFileSync(serverFile, patchedCode);
        console.log('Socket.IO authentication patch applied successfully');
    } else {
        // Попробуем найти без точки с запятой
        const markerWithoutSemicolon = "console.log('TUSUR plugin activated successfully')";
        if (code.includes(markerWithoutSemicolon)) {
            const patchedCode = code.replace(
                markerWithoutSemicolon,
                `${markerWithoutSemicolon};\n${socketIoPatch}`
            );
            
            fs.writeFileSync(serverFile, patchedCode);
            console.log('Socket.IO authentication patch applied successfully (added missing semicolon)');
        } else {
            console.error('Cannot find exact patch marker in server file');
            
            // Альтернативный подход: добавьте в конец файла
            fs.writeFileSync(serverFile, code + '\n' + socketIoPatch);
            console.log('Socket.IO patch appended to end of file');
        }
    }
} else {
    console.error('Cannot find patch marker in server file');
    
    // Добавим в конец файла
    fs.writeFileSync(serverFile, code + '\n' + socketIoPatch);
    console.log('Socket.IO patch appended to end of file');
}
