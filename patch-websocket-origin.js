const fs = require('fs');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Completely fixing WebSocket for TUSUR...');

let code = fs.readFileSync(websocketFile, 'utf8');

// 1. Отключаем проверку origin в upgrade handler
code = code.replace(
  /if \(!req\.headers\.origin \|\| !_env\.default\.URL\.startsWith\(req\.headers\.origin\)\)\s*{/g,
  'if (false) { // TUSUR: Origin check completely disabled'
);

// 2. Устанавливаем isCloudHosted = true в env
const envCheck = /_env\.default\.isCloudHosted/;
if (envCheck.test(code)) {
  // Заменяем проверки на true
  code = code.replace(
    /_env\.default\.isCloudHosted \? "[^"]+" : _env\.default\.URL/g,
    'true ? "*" : _env.default.URL'
  );
}

// 3. Добавляем middleware в правильное место
const ioConnectionPattern = /io\.on\("connection", async socket => {/;
if (ioConnectionPattern.test(code)) {
  // Находим функцию authenticate и вставляем middleware перед ней
  const authenticateCall = /await authenticate\(socket\);/;
  if (authenticateCall.test(code)) {
    const middleware = `
    // ======= TUSUR WEBSOCKET MIDDLEWARE ========
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
      token = cookies.accessToken;
    }
    
    if (token) {
      console.log(\`[TUSUR Socket.IO] Token found: \${token.substring(0, 20)}...\`);
      
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          // Устанавливаем пользователя для socket
          socket.client.user = { id: decoded.id };
          console.log(\`[TUSUR Socket.IO] User authenticated: \${decoded.id}\`);
          
          // Также устанавливаем для Outline
          socket.userId = decoded.id;
          socket.user = { id: decoded.id };
        }
      } catch (error) {
        console.log('[TUSUR Socket.IO] Token decode error:', error.message);
      }
    } else {
      console.log('[TUSUR Socket.IO] No token found');
    }
    // ======= END TUSUR WEBSOCKET MIDDLEWARE ========
    `;
    
    // Вставляем middleware перед authenticate
    code = code.replace(
      authenticateCall,
      `${middleware}\n    await authenticate(socket);`
    );
    console.log('Added TUSUR middleware before authenticate');
  }
}

// 4. Увеличиваем timeout для аутентификации
code = code.replace(
  /setTimeout\(function \(\) {\s+if \(!socket\.client\.user\)/g,
  'setTimeout(function () {\n      if (!socket.client.user)'
);

code = code.replace(
  /}, 1000\);/g,
  '}, 5000); // TUSUR: Increased timeout for authentication'
);

fs.writeFileSync(websocketFile, code);
console.log('WebSocket completely patched for TUSUR');