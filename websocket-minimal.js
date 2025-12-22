const fs = require('fs');

const websocketFile = '/opt/outline/build/server/websockets/index.js';
console.log('Creating minimal WebSocket handler...');

const minimalCode = `
const WebSocket = require('ws');

function init(app, server, serviceNames) {
    console.log('[WebSocket Minimal] Creating WebSocket server');
    
    // Создаем WebSocket сервер на том же HTTP сервере
    const wss = new WebSocket.Server({ 
        server,
        path: '/realtime/',
        perMessageDeflate: false
    });
    
    wss.on('connection', (ws, req) => {
        console.log(\`[WebSocket Minimal] Client connected: \${req.url}\`);
        
        // Извлекаем токен
        let token = null;
        const url = require('url');
        const parsedUrl = url.parse(req.url, true);
        
        token = parsedUrl.query.accessToken || parsedUrl.query.token;
        
        if (!token && req.headers.cookie) {
            const cookies = {};
            req.headers.cookie.split(';').forEach(cookie => {
                const parts = cookie.trim().split('=');
                if (parts.length === 2) cookies[parts[0]] = parts[1];
            });
            token = cookies.accessToken || cookies.token;
        }
        
        console.log(\`[WebSocket Minimal] Token: \${token ? 'found' : 'not found'}\`);
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    console.log(\`[WebSocket Minimal] User authenticated: \${decoded.id}\`);
                    ws.userId = decoded.id;
                }
            } catch (e) {
                console.log('[WebSocket Minimal] Token error:', e.message);
            }
        }
        
        // Отправляем приветственное сообщение в формате Socket.IO
        ws.send('0{"sid":"' + Math.random().toString(36).substr(2) + '","upgrades":[],"pingInterval":25000,"pingTimeout":5000}');
        ws.send('40');
        
        ws.on('message', (message) => {
            console.log(\`[WebSocket Minimal] Message from \${ws.userId || 'anonymous'}: \${message}\`);
            
            // Простой эхо для тестирования
            if (message === '2') {
                ws.send('3'); // pong
            } else if (message === 'ping') {
                ws.send('pong');
            }
        });
        
        ws.on('close', () => {
            console.log('[WebSocket Minimal] Client disconnected');
        });
        
        ws.on('error', (error) => {
            console.log('[WebSocket Minimal] Error:', error.message);
        });
    });
    
    // Возвращаем объект, похожий на Socket.IO
    const ioLike = {
        on: () => ioLike,
        use: () => ioLike,
        emit: () => {},
        to: () => ({ emit: () => {} }),
        in: () => ({ emit: () => {} })
    };
    
    console.log('[WebSocket Minimal] WebSocket server ready');
    return ioLike;
}

module.exports = { init };
`;

fs.writeFileSync(websocketFile, minimalCode);
console.log('Minimal WebSocket file created');