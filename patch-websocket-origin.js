const fs = require('fs');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Applying complete TUSUR WebSocket fix...');

if (!fs.existsSync(websocketFile)) {
    console.error('WebSocket file not found');
    process.exit(1);
}

let code = fs.readFileSync(websocketFile, 'utf8');

// ===== 1. ОТКЛЮЧАЕМ ВСЕ ПРОВЕРКИ ORIGIN =====
code = code.replace(
  /if \(!_env\.default\.isCloudHosted && \(!req\.headers\.origin \|\| !_env\.default\.URL\.startsWith\(req\.headers\.origin\)\)\)/g,
  'if (false) // TUSUR: Origin checks completely disabled'
);

// ===== 2. ИСПРАВЛЯЕМ ПРОВЕРКУ ПУТИ =====
code = code.replace(
  /if \(req\.url\?\.startsWith\(path\)/g,
  'if (req.url && (req.url.startsWith(path) || req.url.startsWith(path + "/")))'
);

// ===== 3. ОТКЛЮЧАЕМ ТАЙМАУТ АУТЕНТИФИКАЦИИ =====
code = code.replace(
  /setTimeout\(function \(\) {\s+if \(!socket\.client\.user\)/g,
  'setTimeout(function () {\n      if (false) // TUSUR: Authentication timeout disabled'
);

// ===== 4. ДОБАВЛЯЕМ CORS ДЛЯ SOCKET.IO =====
const corsPattern = /cors: {\s+origin: _env\.default\.isCloudHosted \? "[^"]+" : _env\.default\.URL/g;
if (corsPattern.test(code)) {
  code = code.replace(
    corsPattern,
    'cors: {\n      origin: "*", // TUSUR: Allow all origins'
  );
}

// ===== 5. ДОБАВЛЯЕМ TUSUR MIDDLEWARE =====
// Находим место для вставки middleware
const authenticateCall = /await authenticate\(socket\);/;
if (authenticateCall.test(code)) {
  const tusurMiddleware = `
    // ======= TUSUR AUTH MIDDLEWARE ========
    console.log(\`[TUSUR WebSocket] Connection: \${socket.id}\`);
    
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
      console.log(\`[TUSUR WebSocket] Token found (\${token.substring(0, 20)}...)\`);
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          socket.client.user = { id: decoded.id };
          socket.userId = decoded.id;
          console.log(\`[TUSUR WebSocket] User authenticated: \${decoded.id}\`);
        }
      } catch (e) {
        console.log('[TUSUR WebSocket] Token error:', e.message);
      }
    }
    // ======= END TUSUR AUTH MIDDLEWARE ========
  `;
  
  code = code.replace(authenticateCall, `${tusurMiddleware}\n    await authenticate(socket);`);
}

// ===== 6. ДОБАВЛЯЕМ ПОДДЕРЖКУ EIO4 =====
const ioServerPattern = /const io = new _socket\.default\.Server\(server, {/;
if (ioServerPattern.test(code)) {
  code = code.replace(
    ioServerPattern,
    `const io = new _socket.default.Server(server, {
    path,
    serveClient: false,
    cookie: false,
    pingInterval: 15000,
    pingTimeout: 30000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    allowEIO3: true,
    allowEIO4: true`
  );
}

fs.writeFileSync(websocketFile, code);
console.log('Complete TUSUR WebSocket fix applied');