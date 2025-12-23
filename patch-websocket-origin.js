const { Server } = require('socket.io');

function init(app, server, serviceNames) {
    console.log('[TUSUR WebSocket] Initializing Socket.IO v4 server');
    
    const io = new Server(server, {
        path: '/realtime/',
        cors: {
            origin: function(origin, callback) {
                console.log('[TUSUR CORS] Origin:', origin);
                // Разрешаем все origin для тестирования
                callback(null, true);
            },
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS']
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
        allowEIO4: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
        // Критически важные настройки для engine.io
        allowUpgrades: true,
        perMessageDeflate: false,
        httpCompression: false,
        // Отключаем проверки
        allowRequest: (req, callback) => {
            console.log('[TUSUR allowRequest] Incoming WebSocket request');
            console.log('[TUSUR allowRequest] URL:', req.url);
            console.log('[TUSUR allowRequest] Headers:', req.headers);
            callback(null, true); // Разрешаем все
        }
    });

    // Middleware для логирования
    io.use((socket, next) => {
        console.log(`[TUSUR Socket.IO] New connection: ${socket.id}`);
        console.log('[TUSUR Socket.IO] Query:', socket.handshake.query);
        console.log('[TUSUR Socket.IO] Headers:', socket.handshake.headers);
        
        // Извлекаем токен
        const token = socket.handshake.query.accessToken || 
                     socket.handshake.query.token ||
                     (socket.handshake.headers.cookie && 
                      socket.handshake.headers.cookie.match(/accessToken=([^;]+)/)?.[1]);
        
        if (token) {
            console.log(`[TUSUR Socket.IO] Token found (${token.substring(0, 20)}...)`);
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    socket.userId = decoded.id;
                    console.log(`[TUSUR Socket.IO] User ID: ${decoded.id}`);
                }
            } catch (e) {
                console.log('[TUSUR Socket.IO] Token error:', e.message);
            }
        }
        
        next();
    });

    io.on('connection', (socket) => {
        console.log(`[TUSUR Socket.IO] Client connected: ${socket.id}`);
        
        // Отправляем подтверждение
        socket.emit('connected', { 
            sid: socket.id,
            message: 'Connected to TUSUR Outline',
            time: new Date().toISOString()
        });
        
        socket.on('disconnect', (reason) => {
            console.log(`[TUSUR Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
        });
        
        // Ping/pong для keepalive
        socket.on('ping', (data) => {
            socket.emit('pong', { ...data, serverTime: Date.now() });
        });
        
        // Обработка сообщений
        socket.on('message', (data) => {
            console.log(`[TUSUR Socket.IO] Message from ${socket.id}:`, data);
            socket.emit('message', { 
                echo: data, 
                receivedAt: new Date().toISOString() 
            });
        });
    });

    console.log('[TUSUR WebSocket] Socket.IO server initialized');
    return io;
}

module.exports = { init };