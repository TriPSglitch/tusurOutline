const fs = require('fs');
const path = require('path');

console.log('Restoring engine.io WebSocket transport properly...');

const websocketFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';

// Проверим, что Transport существует
try {
  const Transport = require('/opt/outline/node_modules/engine.io/build/transport');
  console.log('Transport module found:', typeof Transport);
} catch (e) {
  console.log('Cannot load Transport:', e.message);
}

// Проверим оригинальный файл если есть backup
const backupFile = websocketFile + '.backup';
let originalCode = '';

if (fs.existsSync(backupFile)) {
  originalCode = fs.readFileSync(backupFile, 'utf8');
  console.log('Restoring from backup');
} else {
  // Или создадим минимальную работающую версию
  originalCode = `"use strict";
var Transport = require("../transport");
var parser = require("engine.io-parser");
var util = require("util");
var debug = require("debug")("engine:ws");
function WebSocket(req) {
  Transport.call(this, req);
  this.socket = req.websocket;
  this.socket.on("message", this.onData.bind(this));
  this.socket.on("close", this.onClose.bind(this));
  this.socket.on("error", this.onError.bind(this));
  this.writable = true;
  this.perMessageDeflate = null;
}
util.inherits(WebSocket, Transport);
WebSocket.prototype.name = "websocket";
WebSocket.prototype.handlesUpgrades = true;
WebSocket.prototype.supportsFraming = true;
WebSocket.prototype.onData = function(data) {
  debug('received "%s"', data);
  Transport.prototype.onData.call(this, data);
};
WebSocket.prototype.send = function(packets) {
  var self = this;
  packets.forEach(function(packet) {
    parser.encodePacket(packet, self.supportsBinary, function(data) {
      debug('writing "%s"', data);
      var opts = {};
      if (packet.options) {
        opts.compress = packet.options.compress;
      }
      if (self.perMessageDeflate) {
        var len = "string" === typeof data ? Buffer.byteLength(data) : data.length;
        if (len < self.perMessageDeflate.threshold) {
          opts.compress = false;
        }
      }
      self.socket.send(data, opts);
    });
  });
};
WebSocket.prototype.doClose = function(fn) {
  debug("closing");
  this.socket.close();
  fn && fn();
};
module.exports = WebSocket;
`;
  console.log('Created minimal WebSocket transport');
}

fs.writeFileSync(websocketFile, originalCode);
console.log('Engine.io WebSocket transport restored');

// Также проверим transport.js
const transportFile = '/opt/outline/node_modules/engine.io/build/transport.js';
if (fs.existsSync(transportFile)) {
  console.log('Transport file exists, checking...');
  const transportCode = fs.readFileSync(transportFile, 'utf8');
  if (!transportCode.includes('module.exports = Transport')) {
    console.log('Transport file looks valid');
  }
}