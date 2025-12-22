// websocket-engine-fix.js
const fs = require('fs');
const path = require('path');

const websocketFile = '/opt/outline/build/server/websockets/index.js';
console.log('Fixing engine transport upgrade...');

let code = fs.readFileSync(websocketFile, 'utf8');

if (code.includes('ENGINE_UPGRADE_FIX')) {
    console.log('Already patched');
    process.exit(0);
}

const fix = `
// ======= ENGINE UPGRADE FIX ========
console.log('ENGINE_UPGRADE_FIX: Patching Socket.IO engine');

// Monkey patch для исправления upgrade
const originalInit = (() => {
    // Сохраняем оригинальную функцию
    const original = require('/opt/outline/build/server/websockets/index.js').init;
    
    return function(app, server, serviceNames) {
        console.log('[Engine Fix] Initializing WebSocket with fixed upgrade');
        
        const io = original.call(this, app, server, serviceNames);
        
        // Исправляем обработку upgrade
        if (io.engine) {
            const originalHandleRequest = io.engine.handleRequest;
            
            io.engine.handleRequest = function(req, res) {
                console.log(\`[Engine Fix] Request: \${req.method} \${req.url}\`);
                console.log(\`[Engine Fix] Upgrade header: \${req.headers.upgrade}\`);
                console.log(\`[Engine Fix] Connection header: \${req.headers.connection}\`);
                
                // Разрешаем все upgrade
                if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
                    console.log('[Engine Fix] Allowing WebSocket upgrade');
                    
                    // Добавляем заголовки если их нет
                    if (!req.headers.origin) {
                        req.headers.origin = req.headers.host || 'https://outline-docs.tusur.ru';
                    }
                    
                    if (!req.headers.secwebsocketversion) {
                        req.headers.secwebsocketversion = '13';
                    }
                }
                
                return originalHandleRequest.call(this, req, res);
            };
        }
        
        // Middleware для аутентификации
        io.use((socket, next) => {
            console.log(\`[Engine Fix] Socket connection: \${socket.id}\`);
            
            // Пробуем получить токен
            let token = socket.handshake.query.accessToken || 
                       socket.handshake.query.token;
            
            if (!token && socket.handshake.headers.cookie) {
                const cookies = {};
                socket.handshake.headers.cookie.split(';').forEach(cookie => {
                    const [key, value] = cookie.trim().split('=');
                    if (key && value) cookies[key] = value;
                });
                
                token = cookies.accessToken || cookies.token;
            }
            
            console.log(\`[Engine Fix] Token: \${token ? 'found' : 'not found'}\`);
            
            if (token) {
                try {
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(token);
                    if (decoded && decoded.id) {
                        socket.userId = decoded.id;
                        console.log(\`[Engine Fix] User authenticated: \${decoded.id}\`);
                    }
                } catch (e) {
                    console.log('[Engine Fix] Token decode error:', e.message);
                }
            }
            
            next();
        });
        
        return io;
    };
})();

// Заменяем экспорт
module.exports = { init: originalInit };
// ======= END ENGINE UPGRADE FIX ========
`;

// Добавляем патч
if (code.includes('module.exports')) {
    // Заменяем весь экспорт
    code = code.replace(/module\.exports\s*=.*$/m, fix);
} else {
    code += fix;
}

fs.writeFileSync(websocketFile, code);
console.log('Engine upgrade fix applied');