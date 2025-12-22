const fs = require('fs');
const path = require('path');

console.log('Creating WebSocket directory...');
const wsDir = '/opt/outline/build/server/websockets';
if (!fs.existsSync(wsDir)) {
    fs.mkdirSync(wsDir, { recursive: true });
}

const wsFile = path.join(wsDir, 'index.js');
const content = `
const { Server } = require('socket.io');

function init(app, server, serviceNames) {
    console.log('[WebSocket] Creating Socket.IO server');
    
    const io = new Server(server, {
        path: '/realtime',
        cors: {
            origin: true, // Разрешить все origin для тестирования
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        allowEIO4: true,
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Отключаем проверки для тестирования
    io.engine.on("connection", (socket) => {
        console.log('[WebSocket] Raw connection');
        const req = socket.request;
        console.log('[WebSocket] URL:', req.url);
        console.log('[WebSocket] Headers:', req.headers);
    });

    io.use((socket, next) => {
        console.log(\`[WebSocket] Connection: \${socket.id}\`);
        
        // Разрешаем все соединения
        next();
    });

    io.on('connection', (socket) => {
        console.log(\`[WebSocket] Client connected: \${socket.id}\`);
        
        socket.emit('connected', { sid: socket.id });
        
        socket.on('disconnect', () => {
            console.log(\`[WebSocket] Client disconnected: \${socket.id}\`);
        });
    });

    console.log('[WebSocket] Server ready');
    return io;
}

module.exports = { init };
`;

fs.writeFileSync(wsFile, content);
console.log('WebSocket file created at:', wsFile);