// websocket-token-patch.js
const fs = require('fs');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching WebSocket token handling (fixed version)...');

let code = fs.readFileSync(serverFile, 'utf8');

// Сначала исправим синтаксическую ошибку
if (code.includes('let tusurModels = null;')) {
    // Проверяем, нет ли двойного объявления
    const lines = code.split('\n');
    let tusurModelsCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('tusurModels') && lines[i].includes('let') || lines[i].includes('const')) {
            tusurModelsCount++;
        }
    }
    
    if (tusurModelsCount > 1) {
        console.log('Found multiple tusurModels declarations, fixing...');
        // Удаляем лишние объявления, оставляя первое
        let firstFound = false;
        const fixedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('tusurModels') && (lines[i].includes('let') || lines[i].includes('const'))) {
                if (!firstFound) {
                    fixedLines.push(lines[i]);
                    firstFound = true;
                } else {
                    // Заменяем на const (если это объявление) или удаляем
                    if (lines[i].includes('=')) {
                        // Это объявление с присваиванием - заменяем на присваивание без let/const
                        fixedLines.push(lines[i].replace(/^(let|const)\s+tusurModels\s*=/, 'tusurModels ='));
                    } else {
                        // Пропускаем лишнее объявление
                        console.log(`Skipping duplicate declaration at line ${i + 1}`);
                    }
                }
            } else {
                fixedLines.push(lines[i]);
            }
        }
        
        code = fixedLines.join('\n');
        fs.writeFileSync(serverFile, code);
        console.log('Fixed duplicate variable declarations');
    }
}

// Теперь добавляем WebSocket патч
if (code.includes('WEBSOCKET_TOKEN_PATCH_APPLIED')) {
    console.log('WebSocket token patch already applied');
    process.exit(0);
}

const patch = `
// ======= WEBSOCKET TOKEN PATCH ========
console.log('WEBSOCKET_TOKEN_PATCH_APPLIED: Adding token extraction from cookies');

// Патчим обработку WebSocket соединений
const patchWebSocketHandling = () => {
    console.log('[WebSocket Patch] Setting up WebSocket handling');
    
    if (typeof app !== 'undefined' && app.createWebsocketServer) {
        const originalCreateWebsocketServer = app.createWebsocketServer;
        
        app.createWebsocketServer = function(server, services) {
            console.log('[WebSocket Patch] Creating patched WebSocket server');
            const io = originalCreateWebsocketServer.call(this, server, services);
            
            // Добавляем middleware для извлечения токена из cookies
            io.use((socket, next) => {
                console.log(\`[WebSocket Patch] Socket middleware for: \${socket.id}\`);
                
                // Извлекаем cookies из handshake
                const cookieHeader = socket.handshake.headers.cookie;
                
                if (cookieHeader) {
                    // Парсим cookies
                    const cookies = {};
                    cookieHeader.split(';').forEach(cookie => {
                        const parts = cookie.trim().split('=');
                        if (parts.length === 2) {
                            cookies[parts[0]] = parts[1];
                        }
                    });
                    
                    // Добавляем accessToken в query, если он есть в cookies
                    if (cookies.accessToken && !socket.handshake.query.accessToken) {
                        socket.handshake.query.accessToken = cookies.accessToken;
                        console.log(\`[WebSocket Patch] Added token from cookies: \${cookies.accessToken.substring(0, 20)}...\`);
                    }
                    
                    // Добавляем sessionId
                    if (cookies['connect.sid']) {
                        const sid = cookies['connect.sid'];
                        const sessionId = sid.replace(/^s:/, '').split('.')[0];
                        socket.handshake.query.sessionId = sessionId;
                    }
                }
                
                // Продолжаем стандартную обработку
                next();
            });
            
            return io;
        };
        
        console.log('[WebSocket Patch] WebSocket server patched successfully');
    } else {
        console.log('[WebSocket Patch] Cannot find app.createWebsocketServer');
    }
};

// Вызываем патч при загрузке
setTimeout(patchWebSocketHandling, 1000);
// ======= END WEBSOCKET TOKEN PATCH ========
`;

// Добавляем патч
const marker = 'TUSUR plugin activated successfully';
if (code.includes(marker)) {
    const markerIndex = code.indexOf(marker);
    const insertIndex = markerIndex + marker.length + 1;
    const patchedCode = code.slice(0, insertIndex) + '\n' + patch + code.slice(insertIndex);
    fs.writeFileSync(serverFile, patchedCode);
    console.log('WebSocket token patch applied successfully');
} else {
    // Добавляем в конец
    fs.writeFileSync(serverFile, code + '\n' + patch);
    console.log('WebSocket token patch appended to end of file');
}