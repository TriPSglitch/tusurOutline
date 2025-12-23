const fs = require('fs');

const file = '/opt/outline/build/server/services/websockets.js';
let code = fs.readFileSync(file, 'utf8');

// Критически важно: исправляем проверку upgrade
const upgradeSection = code.indexOf('server.on("upgrade"');
if (upgradeSection !== -1) {
  // Находим и заменяем весь upgrade handler
  const upgradeHandler = code.substring(upgradeSection);
  const nextFunction = upgradeHandler.indexOf('server.on("') > 0 ? upgradeHandler.indexOf('server.on("', 1) : -1;
  
  let handlerCode;
  if (nextFunction !== -1) {
    handlerCode = upgradeHandler.substring(0, nextFunction);
  } else {
    handlerCode = upgradeHandler;
  }
  
  // Заменяем на простой handler без проверок
  const fixedHandler = `  server.on("upgrade", function (req, socket, head) {
    console.log('[TUSUR UPGRADE] WebSocket upgrade request:', req.url);
    console.log('[TUSUR UPGRADE] Origin:', req.headers.origin);
    
    if (req.url && req.url.includes('/realtime')) {
      // Всегда разрешаем WebSocket для TUSUR
      console.log('[TUSUR UPGRADE] Allowing WebSocket upgrade');
      if (ioHandleUpgrade) {
        ioHandleUpgrade(req, socket, head);
      }
      return;
    }
    
    if (serviceNames.includes("collaboration")) {
      return;
    }

    socket.end(\`HTTP/1.1 400 Bad Request\\r\\n\`);
  });`;
  
  code = code.replace(handlerCode, fixedHandler);
  console.log('Replaced upgrade handler');
}

// Также отключаем проверку CORS в Socket.IO
code = code.replace(
  /cors: {\s+origin: _env\.default\.isCloudHosted \? "\*" : _env\.default\.URL,/g,
  `cors: {
      origin: "*", // TUSUR: Allow all origins
      methods: ["GET", "POST"],
      credentials: true`
);

fs.writeFileSync(file, code);
console.log('Emergency WebSocket fix applied');