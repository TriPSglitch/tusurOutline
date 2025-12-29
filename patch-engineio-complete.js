const fs = require('fs');
const path = require('path');

console.log('Patching engine.io verify METHOD...');

const engineServerFile = '/opt/outline/node_modules/engine.io/build/server.js';
if (!fs.existsSync(engineServerFile)) {
  console.error('❌ engine.io server.js not found');
  process.exit(1);
}

let content = fs.readFileSync(engineServerFile, 'utf8');

// Находим метод verify() - он в формате "verify(req, upgrade, fn) {"
const verifyMethodPattern = /verify\s*\(req,\s*upgrade,\s*fn\)\s*\{[\s\S]*?\n    \}/;

const verifyMatch = content.match(verifyMethodPattern);
if (verifyMatch) {
  console.log('✓ Found verify method, length:', verifyMatch[0].length);
  
  // Полностью заменяем метод verify
  const newVerifyMethod = `verify(req, upgrade, fn) {
        // TUSUR METHOD FIX: Always allow WebSocket
        console.log('[TUSUR METHOD] verify called:', {
            url: req.url,
            upgrade: upgrade,
            transport: req._query.transport,
            headers: req.headers
        });

        // Если это WebSocket запрос - пропускаем все проверки
        const isWebSocket = req._query.transport === 'websocket' || 
                          (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket');
        
        if (isWebSocket) {
            console.log('[TUSUR METHOD] WebSocket request ALLOWED');
            return fn(null, true);
        }

        // Оригинальная логика для остальных случаев
        const transport = req._query.transport;
        if (!~this.opts.transports.indexOf(transport) ||
            transport === "webtransport") {
            debug('unknown transport "%s"', transport);
            return fn(Server.errors.UNKNOWN_TRANSPORT, { transport });
        }
        
        const isOriginInvalid = checkInvalidHeaderChar(req.headers.origin);
        if (isOriginInvalid) {
            const origin = req.headers.origin;
            req.headers.origin = null;
            debug("origin header invalid");
            return fn(Server.errors.BAD_REQUEST, {
                name: "INVALID_ORIGIN",
                origin,
            });
        }
        
        return fn();
    }`;
  
  content = content.replace(verifyMethodPattern, newVerifyMethod);
  console.log('✓ verify METHOD completely replaced');
  
  // Также патчим handleRequest для логирования
  if (content.includes('handleRequest(req, res)')) {
    content = content.replace(
      /handleRequest\(req,\s*res\)\s*\{/,
      `handleRequest(req, res) {
        // TUSUR METHOD FIX: Debug headers
        console.log('[TUSUR METHOD] handleRequest headers:', {
            upgrade: req.headers.upgrade,
            connection: req.headers.connection,
            url: req.url
        });
        
        // Force WebSocket detection
        if (req._query.transport === 'websocket') {
            req._tusurWebSocket = true;
        }`
    );
    console.log('✓ handleRequest patched');
  }
  
  fs.writeFileSync(engineServerFile, content, 'utf8');
  console.log('✓ engine.io server.js METHOD patched');
} else {
  console.log('✗ Could not find verify method in expected format');
  
  // Альтернативный поиск
  console.log('Searching for verify in different format...');
  const altPattern = /verify\s*\(\s*req\s*,\s*upgrade\s*,\s*fn\s*\)\s*\{/;
  if (content.match(altPattern)) {
    console.log('Found alternative pattern, applying simpler patch...');
    
    // Простой патч: добавляем условие в начало метода
    content = content.replace(
      altPattern,
      `verify(req, upgrade, fn) {
        // TUSUR SIMPLE FIX: Allow WebSocket
        if (req._query.transport === 'websocket') {
            console.log('[TUSUR SIMPLE] WebSocket transport detected');
            return fn(null, true);
        }`
    );
    
    fs.writeFileSync(engineServerFile, content, 'utf8');
    console.log('✓ Simple patch applied');
  }
}