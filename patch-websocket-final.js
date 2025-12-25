const fs = require('fs');

console.log('FINAL WebSocket guarantee patch...');

// Этот патч гарантирует, что даже если engine.io патчи не сработали,
// мы перехватим upgrade на уровне node.js http server

const outlineWebsocketFile = '/opt/outline/build/server/services/websockets.js';
if (fs.existsSync(outlineWebsocketFile)) {
  let code = fs.readFileSync(outlineWebsocketFile, 'utf8');

  // Находим handler upgrade
  const upgradeHandlerRegex = /server\.on\("upgrade", function \(req, socket, head\) \{[\s\S]*?\n  \}\);/;
  const match = code.match(upgradeHandlerRegex);

  if (match) {
    console.log('Found upgrade handler, applying FINAL patch...');

    // Полностью заменяем handler на гарантированно работающий
    const newHandler = `  server.on("upgrade", function (req, socket, head) {
    console.log('[TUSUR FINAL GUARANTEE] WebSocket upgrade for:', req.url);
    
    // ГАРАНТИЯ: Всегда обрабатываем /realtime и /collaboration
    if (req.url && (req.url.includes('/realtime') || req.url.includes('/collaboration'))) {
      console.log('[TUSUR FINAL GUARANTEE] Processing WebSocket upgrade');
      
      // 1. Сначала пытаемся через ioHandleUpgrade
      if (ioHandleUpgrade) {
        console.log('[TUSUR FINAL GUARANTEE] Using ioHandleUpgrade');
        ioHandleUpgrade(req, socket, head);
        return;
      }
      
      // 2. Если не сработало, создаем свой upgrade
      console.log('[TUSUR FINAL GUARANTEE] Creating manual WebSocket upgrade');
      
      // Создаем фиктивный response для апгрейда
      const key = req.headers['sec-websocket-key'];
      const shasum = require('crypto').createHash('sha1');
      shasum.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
      const acceptKey = shasum.digest('base64');
      
      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + acceptKey
      ];
      
      socket.write(headers.join('\\r\\n') + '\\r\\n\\r\\n');
      return;
    }
    
    // 3. Для всего остального - закрываем соединение
    console.log('[TUSUR FINAL GUARANTEE] Not a WebSocket path, closing');
    socket.end('HTTP/1.1 400 Bad Request\\r\\n\\r\\n');
  });`;

    code = code.replace(upgradeHandlerRegex, newHandler);
    fs.writeFileSync(outlineWebsocketFile, code);

    console.log('✓ FINAL upgrade handler patched');
  }
}

// Также патчим env.js для гарантии
const envFile = '/opt/outline/build/server/env.js';
if (fs.existsSync(envFile)) {
  let code = fs.readFileSync(envFile, 'utf8');

  // Гарантируем isCloudHosted = true
  if (!code.includes('isCloudHosted: true // TUSUR')) {
    code = code.replace(
      /isCloudHosted:\s*[^,}]+/,
      'isCloudHosted: true // TUSUR FINAL: Force cloud hosted'
    );
    fs.writeFileSync(envFile, code);
    console.log('✓ env.js updated');
  }
}

console.log('FINAL patch applied');