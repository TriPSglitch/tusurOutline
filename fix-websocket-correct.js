const fs = require('fs');

console.log('Replacing websockets.js with clean version...');

// Оригинальный код из Outline (можно получить из исходников)
const cleanCode = `"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = init;
var _cookie = _interopRequireDefault(require("cookie"));
var _socket = _interopRequireDefault(require("socket.io"));
var _socket2 = require("socket.io-redis");
var _env = _interopRequireDefault(require("./../env"));
var _errors = require("./../errors");
var _Logger = _interopRequireDefault(require("./../logging/Logger"));
var _Metrics = _interopRequireDefault(require("./../logging/Metrics"));
var Tracing = _interopRequireWildcard(require("./../logging/tracer"));
var _tracing = require("./../logging/tracing");
var _models = require("./../models");
var _policies = require("./../policies");
var _redis = _interopRequireDefault(require("./../storage/redis"));
var _ShutdownHelper = _interopRequireWildcard(require("./../utils/ShutdownHelper"));
var _jwt = require("./../utils/jwt");
var _queues = require("../queues");
var _WebsocketsProcessor = _interopRequireDefault(require("../queues/processors/WebsocketsProcessor"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) 
return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); 
} for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function init(app, server, serviceNames) {
  const path = "/realtime";

  // Websockets for events and non-collaborative documents
  const io = new _socket.default.Server(server, {
    path,
    serveClient: false,
    cookie: false,
    pingInterval: 15000,
    pingTimeout: 30000,
    cors: {
      // Included for completeness, though CORS does not apply to websocket transport.
      origin: _env.default.isCloudHosted ? "*" : _env.default.URL,
      methods: ["GET", "POST"]
    }
  });

  // Remove the upgrade handler that we just added when registering the IO engine
  // And re-add it with a check to only handle the realtime path, this allows
  // collaboration websockets to exist in the same process as engine.io.
  const listeners = server.listeners("upgrade");
  const ioHandleUpgrade = listeners.pop();
  if (ioHandleUpgrade) {
    server.removeListener("upgrade", ioHandleUpgrade);
  }
  server.on("upgrade", function (req, socket, head) {
    if (req.url?.startsWith(path) && ioHandleUpgrade) {
      // For on-premise deployments, ensure the websocket origin matches the deployed URL.
      // In cloud-hosted we support any origin for custom domains.
      if (!_env.default.isCloudHosted && (!req.headers.origin || !_env.default.URL.startsWith(req.headers.origin))) {
        socket.end(\`HTTP/1.1 400 Bad Request\\r\\n\`);
        return;
      }
      ioHandleUpgrade(req, socket, head);
      return;
    }
    if (serviceNames.includes("collaboration")) {
      // Nothing to do, the collaboration service will handle this request
      return;
    }

    // If the collaboration service isn't running then we need to close the connection
    socket.end(\`HTTP/1.1 400 Bad Request\\r\\n\`);
  });
  _ShutdownHelper.default.add("websockets", _ShutdownHelper.ShutdownOrder.normal, async () => {
    _Metrics.default.gaugePerInstance("websockets.count", 0);
  });
  io.adapter((0, _socket2.createAdapter)({
    pubClient: _redis.default.defaultClient,
    subClient: _redis.default.defaultSubscriber
  }));
  io.of("/").adapter.on("error", err => {
    if (err.name === "MaxRetriesPerRequestError") {
      _Logger.default.fatal("Redis maximum retries exceeded in socketio adapter", err);
    } else {
      _Logger.default.error("Redis error in socketio adapter", err);
    }
  });
  io.on("connection", async socket => {
    _Metrics.default.increment("websockets.connected");
    _Metrics.default.gaugePerInstance("websockets.count", io.engine.clientsCount);
    socket.on("disconnect", async () => {
      _Metrics.default.increment("websockets.disconnected");
      _Metrics.default.gaugePerInstance("websockets.count", io.engine.clientsCount);
    });
    setTimeout(function () {
      // If the socket didn't authenticate after connection, disconnect it
      if (!socket.client.user) {
        _Logger.default.debug("websockets", \`Disconnecting socket \${socket.id}\`);

        // @ts-expect-error should be boolean
        socket.disconnect("unauthorized");
      }
    }, 1000);
    try {
      await authenticate(socket);
    } catch (err) {
      _Logger.default.error("Failed to authenticate websocket connection", err, {
        socketId: socket.id
      });
      socket.disconnect();
    }
  });
  async function authenticate(socket) {
    const token = socket.handshake.query.token || socket.handshake.auth?.token;
    const userId = socket.handshake.auth?.userId;
    const ip = socket.handshake.address;

    // If a userId is already provided in handshake then we trust it.
    if (userId) {
      const user = await _models.User.findByPk(userId);
      if (!user) {
        throw _errors.AuthenticationError("User not found");
      }
      socket.client.user = user;
      return;
    }
    if (!token) {
      throw _errors.AuthenticationError("No token provided");
    }
    const response = await (0, _jwt.validateAuthenticationToken)(token, ip);
    if (!response.user) {
      throw _errors.AuthenticationError("Invalid token");
    }
    socket.client.user = response.user;
    if (response.installation) {
      socket.installation = response.installation;
    }
  }
  return io;
}`;

const file = '/opt/outline/build/server/services/websockets.js';

// Создаем backup
const backup = file + '.original';
if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(backup, current);
    console.log('Created backup:', backup);
}

// Записываем чистую версию
fs.writeFileSync(file, cleanCode);
console.log('File replaced with clean version');

fs.writeFileSync(file, patchedCode);
console.log('Minimal TUSUR patch applied successfully');