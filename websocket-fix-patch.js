// websocket-fix-patch.js
const fs = require('fs');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Applying WebSocket fix patch...');

let code = fs.readFileSync(serverFile, 'utf8');

if (code.includes('WEBSOCKET_FIX_PATCH_APPLIED')) {
    console.log('WebSocket fix already applied');
    process.exit(0);
}

const patch = `
// ======= WEBSOCKET FIX PATCH ========
console.log('WEBSOCKET_FIX_PATCH_APPLIED: Fixing WebSocket authentication');

// Monkey patch для WebSocket сервера
const originalInit = require('./server/websockets').init;

if (originalInit) {
    require('./server/websockets').init = function(app, server, serviceNames) {
        console.log('[WebSocket Fix] Initializing WebSocket with TUSUR authentication');
        
        const io = originalInit.call(this, app, server, serviceNames);
        
        // Добавляем middleware для аутентификации
        io.use(async (socket, next) => {
            console.log(\`[WebSocket Fix] Socket connection attempt: \${socket.id}\`);
            
            // 1. Проверяем token в query параметрах (основной способ)
            let token = socket.handshake.query.accessToken || 
                       socket.handshake.query.token;
            
            // 2. Если нет в query, проверяем cookies
            if (!token && socket.handshake.headers.cookie) {
                const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    acc[key] = value;
                    return acc;
                }, {});
                
                token = cookies.accessToken;
            }
            
            console.log(\`[WebSocket Fix] Token found: \${token ? 'YES' : 'NO'}\`);
            
            if (!token) {
                console.log('[WebSocket Fix] No token found, allowing for public access');
                return next();
            }
            
            try {
                // Декодируем токен
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                
                if (!decoded || !decoded.id) {
                    console.log('[WebSocket Fix] Invalid token format');
                    return next();
                }
                
                // Находим пользователя
                const User = require('./models').User;
                const user = await User.findOne({
                    where: { id: decoded.id }
                });
                
                if (user) {
                    console.log(\`[WebSocket Fix] User authenticated: \${user.email}\`);
                    
                    // Прикрепляем пользователя к сокету
                    socket.user = user;
                    socket.userId = user.id;
                    
                    return next();
                }
                
                console.log(\`[WebSocket Fix] User not found: \${decoded.id}\`);
                return next();
                
            } catch (error) {
                console.error('[WebSocket Fix] Authentication error:', error);
                return next();
            }
        });
        
        return io;
    };
    
    console.log('[WebSocket Fix] WebSocket server patched successfully');
}
// ======= END WEBSOCKET FIX PATCH ========
`;

// Добавляем патч в конец файла
code += '\n' + patch;

fs.writeFileSync(serverFile, code);
console.log('WebSocket fix patch applied successfully');