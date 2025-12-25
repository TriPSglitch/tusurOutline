const fs = require('fs');
const path = require('path');

console.log('Applying final WebSocket fix for TUSUR...');

const websocketFile = '/opt/outline/build/server/services/websockets.js';

// Проверяем существует ли файл
if (!fs.existsSync(websocketFile)) {
  console.error('WebSocket file not found:', websocketFile);
  process.exit(1);
}

let code = fs.readFileSync(websocketFile, 'utf8');

// 1. Отключаем проверку origin полностью
code = code.replace(
  /if \(!req\.headers\.origin \|\| !_env\.default\.URL\.startsWith\(req\.headers\.origin\)\)\s*{/g,
  'if (false) { // TUSUR: Origin check disabled'
);

// 2. Устанавливаем CORS для всех origins
code = code.replace(
  /origin: _env\.default\.isCloudHosted \? "\*" : _env\.default\.URL,/g,
  'origin: "*", // TUSUR: Allow all origins'
);

// 3. Исправляем проверку пути для upgrade
const upgradeHandlerStart = code.indexOf('server.on("upgrade"');
if (upgradeHandlerStart !== -1) {
  const upgradeHandlerEnd = code.indexOf('\n  });', upgradeHandlerStart);
  if (upgradeHandlerEnd !== -1) {
    const currentHandler = code.substring(upgradeHandlerStart, upgradeHandlerEnd + 5);

    // Новый handler без проверок
    const newHandler = `  server.on("upgrade", function (req, socket, head) {
    console.log('[TUSUR UPGRADE] WebSocket upgrade:', req.url);
    
    // Всегда разрешаем upgrade для /realtime
    if (req.url && (req.url.includes('/realtime') || req.url.startsWith('/realtime'))) {
      console.log('[TUSUR UPGRADE] Allowing WebSocket upgrade');
      if (ioHandleUpgrade) {
        ioHandleUpgrade(req, socket, head);
        return;
      }
    }
    
    if (serviceNames.includes("collaboration")) {
      return;
    }

    socket.end(\`HTTP/1.1 400 Bad Request\\r\\n\`);
  });`;

    code = code.replace(currentHandler, newHandler);
    console.log('Upgrade handler fixed');
  }
}

// 4. Добавляем middleware для извлечения токена из cookies
const ioConnectionMatch = code.match(/io\.on\("connection", async socket => {/);
if (ioConnectionMatch) {
  const insertIndex = ioConnectionMatch.index;

  const middleware = `
  // TUSUR: Middleware for token extraction
  io.use((socket, next) => {
    console.log(\`[TUSUR Socket.IO] Connection: \${socket.id}\`);
    
    // Извлекаем токен из разных источников
    let token = socket.handshake.query.accessToken || 
               socket.handshake.query.token;
    
    // Из cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = {};
      socket.handshake.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) cookies[parts[0]] = parts[1];
      });
      token = cookies.accessToken || cookies.token;
      
      // Добавляем токен в query для совместимости
      if (token && !socket.handshake.query.accessToken) {
        socket.handshake.query.accessToken = token;
      }
    }
    
    console.log(\`[TUSUR Socket.IO] Token found: \${token ? 'YES' : 'NO'}\`);
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          // Сохраняем для authenticate функции
          socket.handshake.auth = socket.handshake.auth || {};
          socket.handshake.auth.userId = decoded.id;
          socket.handshake.auth.token = token;
          console.log(\`[TUSUR Socket.IO] User ID: \${decoded.id}\`);
        }
      } catch (error) {
        console.log('[TUSUR Socket.IO] Token error:', error.message);
      }
    }
    
    next();
  });
  `;

  // Вставляем middleware перед connection handler
  code = code.slice(0, insertIndex) + middleware + code.slice(insertIndex);
  console.log('TUSUR middleware added');
}

// 5. Увеличиваем timeout аутентификации
code = code.replace(
  /setTimeout\(function \(\) {\s+if \(!socket\.client\.user\)/g,
  `setTimeout(function () {
      // TUSUR: Increased timeout to 10 seconds
      if (!socket.client.user) {
        console.log('[TUSUR Socket.IO] No authentication after 10s, disconnecting:', socket.id);`
);

code = code.replace(
  /}, 1000\);/g,
  '}, 10000); // TUSUR: 10 seconds timeout'
);

// 6. Сохраняем файл
fs.writeFileSync(websocketFile, code);
console.log('Final WebSocket fix applied successfully');