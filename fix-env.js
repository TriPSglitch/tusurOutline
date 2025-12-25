const fs = require('fs');
const path = require('path');

console.log('Применение чистого WebSocket фикса для TUSUR...');

// 1. Патчим env.js для правильного URL
const envPath = path.join(__dirname, 'build/server/env.js');
if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Гарантируем правильный URL для WebSocket
    if (!envContent.includes('URL=https://outline-docs.tusur.ru')) {
        envContent = envContent.replace(
            /(URL=)([^\n]*)/,
            'URL=https://outline-docs.tusur.ru'
        );
    }
    
    // Отключаем облачные ограничения
    if (envContent.includes('DEPLOYMENT')) {
        envContent = envContent.replace(
            /(DEPLOYMENT=)([^\n]*)/,
            'DEPLOYMENT=self-hosted'
        );
    } else {
        envContent += '\nDEPLOYMENT=self-hosted\n';
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✓ env.js обновлен');
}

// 2. Патчим socket.io для разрешения WebSocket поверх HTTPS
const socketIoPath = path.join(__dirname, 'node_modules/socket.io/dist/index.js');
if (fs.existsSync(socketIoPath)) {
    let socketIoContent = fs.readFileSync(socketIoPath, 'utf8');
    
    // Добавляем middleware для правильной обработки WebSocket
    if (!socketIoContent.includes('TUSUR WebSocket patch')) {
        const patchMarker = 'applyMiddleware(server, serveClient, connector) {';
        const patch = `applyMiddleware(server, serveClient, connector) {
            // TUSUR WebSocket patch - allow HTTPS WebSocket connections
            const originalHandleRequest = server.handleRequest;
            server.handleRequest = function(req, res) {
                // Fix for nginx proxy
                if (req.headers['x-forwarded-proto'] === 'https') {
                    req.connection.encrypted = true;
                }
                return originalHandleRequest.call(this, req, res);
            };`;
        
        socketIoContent = socketIoContent.replace(patchMarker, patch);
        fs.writeFileSync(socketIoPath, socketIoContent);
        console.log('✓ socket.io патчирован');
    }
}

console.log('Чистый WebSocket фикс применен успешно');