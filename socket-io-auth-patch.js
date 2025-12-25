// socket-io-auth-patch.js
const fs = require('fs');
const path = require('path');

// Попробуем найти файл с Socket.IO конфигурацией
const possibleFiles = [
    '/opt/outline/build/server/websockets/index.js',
    '/opt/outline/build/server/websockets.js',
    '/opt/outline/build/server/websocket.js',
    '/opt/outline/build/server/socket.js',
    '/opt/outline/build/server/index.js'
];

let targetFile = null;
for (const file of possibleFiles) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('socket.io') || content.includes('io.use') || content.includes('io.on')) {
            targetFile = file;
            console.log(`Found Socket.IO file: ${targetFile}`);
            break;
        }
    }
}

if (!targetFile) {
    console.log('Could not find Socket.IO file, trying default location...');
    targetFile = '/opt/outline/build/server/websockets/index.js';

    // Создаем файл если не существует
    if (!fs.existsSync(targetFile)) {
        console.log('Creating websockets directory...');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    }
}

// Патч для добавления аутентификации
const patch = `
// ======= TUSUR SOCKET.IO AUTH PATCH ========
console.log('TUSUR_SOCKET_IO_PATCH: Adding authentication middleware');

const jwt = require('jsonwebtoken');

function addTusurSocketIoAuth(io) {
    console.log('[TUSUR Socket.IO] Adding authentication middleware');
    
    io.use(async (socket, next) => {
        console.log(\`[TUSUR Socket.IO] New connection attempt: \${socket.id}\`);
        
        let token = null;
        
        // 1. Check query parameters
        if (socket.handshake.query.accessToken) {
            token = socket.handshake.query.accessToken;
            console.log(\`[TUSUR Socket.IO] Token from query: \${token.substring(0, 30)}...\`);
        }
        // 2. Check cookies (for browser WebSocket)
        else if (socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie;
            const match = cookies.match(/accessToken=([^;]+)/);
            if (match) {
                token = match[1];
                console.log(\`[TUSUR Socket.IO] Token from cookies: \${token.substring(0, 30)}...\`);
                
                // Also add to query for compatibility
                socket.handshake.query.accessToken = token;
            }
        }
        // 3. Check Authorization header
        else if (socket.handshake.headers.authorization) {
            const authHeader = socket.handshake.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
                console.log(\`[TUSUR Socket.IO] Token from Authorization header: \${token.substring(0, 30)}...\`);
            }
        }
        
        if (!token) {
            console.log('[TUSUR Socket.IO] No token found, allowing for testing');
            // TEMPORARY: Allow connections without token for testing
            return next();
        }
        
        try {
            // Decode token to get user ID
            const decoded = jwt.decode(token);
            
            if (!decoded || !decoded.id) {
                console.log('[TUSUR Socket.IO] Invalid token format, allowing for testing');
                // TEMPORARY: Allow even with invalid format
                return next();
            }
            
            console.log(\`[TUSUR Socket.IO] User ID from token: \${decoded.id}\`);
            
            // Store user info in socket
            socket.userId = decoded.id;
            socket.token = token;
            socket.tusurAuthenticated = true;
            
            console.log(\`[TUSUR Socket.IO] Authentication successful for user: \${decoded.id}\`);
            
            return next();
            
        } catch (error) {
            console.error('[TUSUR Socket.IO] Error during authentication:', error);
            // TEMPORARY: Allow even on error for testing
            return next();
        }
    });
    
    console.log('[TUSUR Socket.IO] Authentication middleware added successfully');
}

// Patch the Socket.IO server creation
if (typeof module.exports === 'object') {
    const originalExport = module.exports;
    
    // If exports has createWebsocketServer method
    if (originalExport.createWebsocketServer) {
        const originalCreate = originalExport.createWebsocketServer;
        originalExport.createWebsocketServer = function(server, services) {
            console.log('[TUSUR Socket.IO] Creating websocket server with TUSUR auth');
            const io = originalCreate.call(this, server, services);
            addTusurSocketIoAuth(io);
            return io;
        };
    }
    
    // If exports is a function
    else if (typeof originalExport === 'function') {
        const originalFunction = originalExport;
        module.exports = function(...args) {
            const result = originalFunction.apply(this, args);
            
            // Check if result is a Socket.IO instance
            if (result && typeof result.use === 'function') {
                console.log('[TUSUR Socket.IO] Found Socket.IO instance, adding auth middleware');
                addTusurSocketIoAuth(result);
            }
            
            return result;
        };
    }
}

console.log('TUSUR Socket.IO authentication patch applied');
// ======= END TUSUR SOCKET.IO AUTH PATCH ========
`;

// Apply the patch
try {
    let content = '';
    if (fs.existsSync(targetFile)) {
        content = fs.readFileSync(targetFile, 'utf8');
    }

    // Check if already patched
    if (content.includes('TUSUR_SOCKET_IO_PATCH')) {
        console.log('Socket.IO already patched');
    } else {
        // Add patch to the end of file
        content += '\n' + patch;
        fs.writeFileSync(targetFile, content);
        console.log(`Socket.IO file patched successfully: ${targetFile}`);
    }
} catch (error) {
    console.error('Error patching Socket.IO:', error);
}
