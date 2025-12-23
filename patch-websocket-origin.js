const fs = require('fs');

const file = '/opt/outline/build/server/services/websockets.js';
console.log('Applying nuclear WebSocket fix...');

// Полностью переписываем файл
const newCode = `
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = init;

function init(app, server, serviceNames) {
  console.log('[TUSUR NUCLEAR] WebSocket service starting');
  
  // Простейший Socket.IO сервер без проверок
  const io = require('socket.io')(server, {
    path: '/realtime',
    serveClient: false,
    cookie: false,
    pingInterval: 15000,
    pingTimeout: 30000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true,
    allowEIO4: true,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: false
  });

  // Middleware для TUSUR
  io.use((socket, next) => {
    console.log(\`[TUSUR Socket.IO] Connection: \${socket.id}\`);
    
    // Извлекаем токен
    let token = socket.handshake.query.accessToken || 
               socket.handshake.query.token;
    
    if (!token && socket.handshake.headers.cookie) {
      const cookies = {};
      socket.handshake.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) cookies[parts[0]] = parts[1];
      });
      token = cookies.accessToken;
    }
    
    if (token) {
      console.log(\`[TUSUR Socket.IO] Token found: \${token.substring(0, 20)}...\`);
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          socket.client.user = { id: decoded.id };
          socket.userId = decoded.id;
          console.log(\`[TUSUR Socket.IO] User authenticated: \${decoded.id}\`);
        }
      } catch (e) {
        console.log('[TUSUR Socket.IO] Token error:', e.message);
      }
    }
    
    next();
  });

  io.on('connection', (socket) => {
    console.log(\`[TUSUR Socket.IO] Client connected: \${socket.id}\`);
    
    socket.on('disconnect', () => {
      console.log(\`[TUSUR Socket.IO] Client disconnected: \${socket.id}\`);
    });
  });

  console.log('[TUSUR NUCLEAR] WebSocket service ready');
  return io;
}

module.exports = init;
`;

fs.writeFileSync(file, newCode);
console.log('Nuclear WebSocket fix applied');