// websocket-simple-fix.js
const fs = require('fs');

const websocketFile = '/opt/outline/build/server/websockets/index.js';
console.log('Applying simplified WebSocket fix...');

let code = fs.readFileSync(websocketFile, 'utf8');

// Убедимся, что файл содержит базовую структуру
if (!code.includes('socket.io')) {
    // Создаем простой WebSocket файл
    code = `
const { Server } = require('socket.io');

function init(app, server, serviceNames) {
    console.log('[WebSocket Simple] Initializing Socket.IO server');
    
    const io = new Server(server, {
        path: '/realtime/',
        cors: {
            origin: '*',
            credentials: true
        },
        allowEIO3: true,
        transports: ['websocket', 'polling']
    });
    
    // Простая аутентификация
    io.use((socket, next) => {
        console.log(\`[WebSocket Simple] New connection: \${socket.id}\`);
        
        // Пробуем получить токен из разных мест
        let token = socket.handshake.query.accessToken || 
                   socket.handshake.query.token;
        
        // Или из cookies
        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});
            
            token = cookies.accessToken || cookies.token;
        }
        
        console.log(\`[WebSocket Simple] Token found: \${token ? 'YES' : 'NO'}\`);
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                
                if (decoded && decoded.id) {
                    socket.userId = decoded.id;
                    console.log(\`[WebSocket Simple] User authenticated: \${decoded.id}\`);
                }
            } catch (e) {
                console.log('[WebSocket Simple] Token decode error:', e.message);
            }
        }
        
        next();
    });
    
    io.on('connection', (socket) => {
        console.log(\`[WebSocket Simple] Client connected: \${socket.id}\`);
        
        socket.on('disconnect', () => {
            console.log(\`[WebSocket Simple] Client disconnected: \${socket.id}\`);
        });
    });
    
    return io;
}

module.exports = { init };
`;
    
    fs.writeFileSync(websocketFile, code);
    console.log('Simple WebSocket file created');
} else {
    console.log('WebSocket file already exists');
}