// websocket-origin-fix.js
const fs = require('fs');

const websocketFile = '/opt/outline/build/server/websockets/index.js';
console.log('Applying WebSocket origin fix to:', websocketFile);

let code = fs.readFileSync(websocketFile, 'utf8');

if (code.includes('TUSUR_WEBSOCKET_FIX')) {
    console.log('WebSocket fix already applied');
    process.exit(0);
}

const fixPatch = `
// ======= TUSUR WEBSOCKET FIX ========
console.log('TUSUR_WEBSOCKET_FIX: Applying origin fix');

// Monkey patch для обработки origin
const originalInit = require('/opt/outline/build/server/websockets/index.js').init;

if (originalInit) {
    require('/opt/outline/build/server/websockets/index.js').init = function(app, server, serviceNames) {
        console.log('[TUSUR WebSocket Fix] Initializing with origin fix');
        
        const io = originalInit.call(this, app, server, serviceNames);
        
        // Отключаем все проверки origin для тестирования
        io.engine.opts.allowRequest = function(req, callback) {
            console.log('[TUSUR WebSocket] WebSocket connection attempt');
            console.log('[TUSUR WebSocket] Origin:', req.headers.origin);
            console.log('[TUSUR WebSocket] Host:', req.headers.host);
            
            // Разрешаем все соединения для отладки
            callback(null, true);
        };
        
        // Middleware для аутентификации
        io.use(async (socket, next) => {
            console.log(\`[TUSUR WebSocket] New connection: \${socket.id}\`);
            
            // Получаем токен из разных источников
            let token = socket.handshake.query.accessToken || 
                       socket.handshake.query.token;
            
            // Если нет в query, проверяем cookies
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
            
            if (!token) {
                console.log('[TUSUR WebSocket] No token found, allowing connection for testing');
                return next();
            }
            
            console.log(\`[TUSUR WebSocket] Token found: \${token.substring(0, 30)}...\`);
            
            try {
                // Пытаемся декодировать токен
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                
                if (decoded && decoded.id) {
                    console.log(\`[TUSUR WebSocket] User ID from token: \${decoded.id}\`);
                    
                    // Находим пользователя
                    const User = require('/opt/outline/build/server/models/index.js').User;
                    const user = await User.findOne({
                        where: { id: decoded.id }
                    });
                    
                    if (user) {
                        socket.userId = user.id;
                        socket.user = user;
                        console.log(\`[TUSUR WebSocket] User authenticated: \${user.email}\`);
                    }
                }
            } catch (error) {
                console.error('[TUSUR WebSocket] Token validation error:', error.message);
            }
            
            next();
        });
        
        console.log('[TUSUR WebSocket Fix] WebSocket server patched successfully');
        return io;
    };
}
// ======= END TUSUR WEBSOCKET FIX ========
`;

// Добавляем патч в конец файла
code += '\n' + fixPatch;

fs.writeFileSync(websocketFile, code);
console.log('WebSocket origin fix applied');