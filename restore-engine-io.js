const fs = require('fs');
const path = require('path');

console.log('Restoring original engine.io WebSocket file...');

const engineIoFile = '/opt/outline/node_modules/engine.io/build/transports/websocket.js';

// Оригинальный код из Outline (адаптированный)
const originalCode = `/**
 * Module dependencies.
 */
var Transport = require("../transport");
var parser = require("engine.io-parser");
var util = require("util");
var debug = require("debug")("engine:ws");
/**
 * WebSocket transport
 *
 * @param {http.IncomingMessage}
 * @api public
 */
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
/**
 * Transport name
 *
 * @api public
 */
WebSocket.prototype.name = "websocket";
/**
 * Advertise upgrade support.
 *
 * @api public
 */
WebSocket.prototype.handlesUpgrades = true;
/**
 * Advertise framing support.
 *
 * @api public
 */
WebSocket.prototype.supportsFraming = true;
/**
 * Processes the incoming data.
 *
 * @param {Buffer} data
 * @api private
 */
WebSocket.prototype.onData = function(data) {
  debug('received "%s"', data);
  Transport.prototype.onData.call(this, data);
};
/**
 * Writes a packet payload.
 *
 * @param {Array} packets
 * @api private
 */
WebSocket.prototype.send = function(packets) {
  var self = this;
  packets.forEach(function(packet) {
    parser.encodePacket(packet, self.supportsBinary, function(data) {
      debug('writing "%s"', data);
      // always create a new object since ws modifies it
      var opts = {};
      if (packet.options) {
        opts.compress = packet.options.compress;
      }
      if (self.perMessageDeflate) {
        var len = 
          "string" === typeof data ? Buffer.byteLength(data) : data.length;
        if (len < self.perMessageDeflate.threshold) {
          opts.compress = false;
        }
      }
      self.socket.send(data, opts);
    });
  });
};
/**
 * Closes the transport.
 *
 * @api private
 */
WebSocket.prototype.doClose = function(fn) {
  debug("closing");
  this.socket.close();
  fn && fn();
};
/**
 * Expose \`WebSocket\`.
 */
module.exports = WebSocket;
`;

if (fs.existsSync(engineIoFile)) {
  // Создаем backup если его нет
  const backupFile = engineIoFile + '.backup';
  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(engineIoFile, backupFile);
    console.log('Created backup:', backupFile);
  }
  
  fs.writeFileSync(engineIoFile, originalCode);
  console.log('Engine.io WebSocket file restored to original');
} else {
  console.error('Engine.io file not found:', engineIoFile);
  
  // Проверяем другие возможные пути
  const possiblePaths = [
    '/opt/outline/node_modules/engine.io/lib/transports/websocket.js',
    '/opt/outline/node_modules/socket.io/node_modules/engine.io/build/transports/websocket.js'
  ];
  
  for (const file of possiblePaths) {
    if (fs.existsSync(file)) {
      console.log('Found engine.io at:', file);
      const backupFile = file + '.backup';
      if (!fs.existsSync(backupFile)) {
        fs.copyFileSync(file, backupFile);
      }
      fs.writeFileSync(file, originalCode);
      console.log('Restored:', file);
      break;
    }
  }
}