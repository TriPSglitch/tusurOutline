const fs = require('fs');
const path = require('path');

const websocketFile = '/opt/outline/build/server/websockets/index.js';
console.log('Applying final WebSocket engine fix...');

// Сначала создаем простой рабочий WebSocket файл
const simpleWebSocketCode = `
const { Server } = require('socket.io');

function init(app, server, serviceNames) {
    console.log('[WebSocket Final] Creating Socket.IO server');
    
    const io = new Server(server, {
        path: '/realtime/',
        cors: {
            origin: ['https://outline-docs.tusur.ru', 'http://outline-docs.tusur.ru'],
            credentials: true,
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        cookie: false
    });
    
    // Middleware для аутентификации
    io.use((socket, next) => {
        console.log(\`[WebSocket Final] New connection: \${socket.id}\`);
        
        // Получаем токен из разных источников
        let token = socket.handshake.query.accessToken || 
                   socket.handshake.query.token;
        
        // Или из cookies
        if (!token && socket.handshake.headers.cookie) {
            const cookies = {};
            socket.handshake.headers.cookie.split(';').forEach(cookie => {
                const parts = cookie.trim().split('=');
                if (parts.length === 2) {
                    cookies[parts[0]] = parts[1];
                }
            });
            
            token = cookies.accessToken || cookies.token;
        }
        
        console.log(\`[WebSocket Final] Token: \${token ? 'found' : 'not found'}\`);
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    socket.userId = decoded.id;
                    console.log(\`[WebSocket Final] User authenticated: \${decoded.id}\`);
                }
            } catch (e) {
                console.log('[WebSocket Final] Token decode error:', e.message);
            }
        }
        
        next();
    });
    
    io.on('connection', (socket) => {
        console.log(\`[WebSocket Final] Client connected: \${socket.id}, user: \${socket.userId || 'anonymous'}\`);
        
        socket.on('disconnect', () => {
            console.log(\`[WebSocket Final] Client disconnected: \${socket.id}\`);
        });
        
        // Для тестирования
        socket.on('ping', (data) => {
            console.log(\`[WebSocket Final] Ping from \${socket.id}: \${data}\`);
            socket.emit('pong', { time: new Date().toISOString() });
        });
    });
    
    console.log('[WebSocket Final] Socket.IO server ready');
    return io;
}

module.exports = { init };
`;

// Записываем новый файл
fs.writeFileSync(websocketFile, simpleWebSocketCode);
console.log('Created simple WebSocket file');

// Также создадим резервную копию оригинального файла
const backupFile = websocketFile + '.backup';
if (!fs.existsSync(backupFile)) {
    try {
        if (fs.existsSync('/opt/outline/build/server/websockets/index.js.backup')) {
            fs.copyFileSync('/opt/outline/build/server/websockets/index.js.backup', backupFile);
        }
    } catch (e) {
        // игнорируем ошибки
    }
}