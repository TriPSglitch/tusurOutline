const fs = require('fs');
const path = require('path');

const websocketFile = '/opt/outline/build/server/services/websockets.js';
console.log('Fixing WebSocket correctly for TUSUR...');

// Полностью восстанавливаем оригинальную структуру с минимальными изменениями
const fixedCode = `
"use strict";

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
      // TUSUR FIX: Allow all origins for testing
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true,
    allowEIO4: true,
    transports: ['websocket', 'polling'],
    allowUpgrades: true
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
    console.log('[TUSUR UPGRADE] Upgrade request:', req.url, 'Origin:', req.headers.origin);
    
    // TUSUR FIX: Relaxed path check
    if (req.url && (req.url.includes('/realtime') || req.url.startsWith('/realtime'))) {
      // TUSUR FIX: Disable origin check completely
      // Always allow WebSocket upgrade for TUSUR
      console.log('[TUSUR UPGRADE] Allowing WebSocket upgrade');
      if (ioHandleUpgrade) {
        ioHandleUpgrade(req, socket, head);
      }
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
  
  // TUSUR FIX: Add middleware for token extraction
  io.use((socket, next) => {
    console.log(\`[TUSUR Socket.IO] Connection attempt: \${socket.id}\`);
    
    // Extract token from query
    let token = socket.handshake.query.accessToken || 
               socket.handshake.query.token;
    
    // Extract from cookies
    if (!token && socket.handshake.headers.cookie) {
      const cookies = {};
      socket.handshake.headers.cookie.split(';').forEach(cookie => {
        const parts = cookie.trim().split('=');
        if (parts.length === 2) cookies[parts[0]] = parts[1];
      });
      token = cookies.accessToken || cookies.token;
    }
    
    console.log(\`[TUSUR Socket.IO] Token found: \${token ? 'YES' : 'NO'}\`);
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded && decoded.id) {
          // Store user info for authenticate function
          socket.handshake.auth = socket.handshake.auth || {};
          socket.handshake.auth.userId = decoded.id;
          socket.handshake.auth.token = token;
          console.log(\`[TUSUR Socket.IO] User ID found: \${decoded.id}\`);
        }
      } catch (error) {
        console.log('[TUSUR Socket.IO] Token error:', error.message);
      }
    }
    
    next();
  });
  
  io.on("connection", async socket => {
    console.log(\`[TUSUR Socket.IO] Client connected: \${socket.id}\`);
    _Metrics.default.increment("websockets.connected");
    _Metrics.default.gaugePerInstance("websockets.count", io.engine.clientsCount);
    socket.on("disconnect", async () => {
      _Metrics.default.increment("websockets.disconnected");
      _Metrics.default.gaugePerInstance("websockets.count", io.engine.clientsCount);
    });
    // TUSUR FIX: Increase authentication timeout
    setTimeout(function () {
      // If the socket didn't authenticate after connection, disconnect it
      if (!socket.client.user) {
        _Logger.default.debug("websockets", \`Disconnecting socket \${socket.id}\`);

        // @ts-expect-error should be boolean
        socket.disconnect("unauthorized");
      }
    }, 5000); // Increased from 1000 to 5000 ms
    try {
      // TUSUR FIX: Pass our extracted auth to authenticate function
      if (socket.handshake.auth && socket.handshake.auth.userId) {
        // Pre-populate user for authenticate function
        socket.client.user = { id: socket.handshake.auth.userId };
      }
      await authenticate(socket);
    } catch (err) {
      if (!(err instanceof _errors.AuthenticationError)) {
        _Logger.default.error("websockets", err);
      }
      socket.disconnect();
    }
  });
  return io;
}
async function authenticate(socket) {
  const cookies = _cookie.default.parse(socket.handshake.headers.cookie || "");
  let accessToken;
  let userId;
  let tokenId;
  try {
    const decoded = (0, _jwt.decodeJwt)(cookies["accessToken"]);
    if (decoded) {
      accessToken = cookies["accessToken"];
      userId = decoded.id;
      tokenId = decoded.tokenId;
    }
  } catch (err) {}
  if (!accessToken) {
    // also try the authorization header
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        accessToken = parts[1];
        try {
          const decoded = (0, _jwt.decodeJwt)(accessToken);
          if (decoded) {
            userId = decoded.id;
            tokenId = decoded.tokenId;
          }
        } catch (err) {}
      }
    }
  }
  // TUSUR FIX: Also check query parameters
  if (!accessToken && socket.handshake.query.accessToken) {
    accessToken = socket.handshake.query.accessToken;
    try {
      const decoded = (0, _jwt.decodeJwt)(accessToken);
      if (decoded) {
        userId = decoded.id;
        tokenId = decoded.tokenId;
      }
    } catch (err) {}
  }
  if (!userId) {
    throw new _errors.AuthenticationError("Unable to find JWT in request");
  }
  const user = await _models.User.findByPk(userId, {
    include: [{
      model: _models.Team,
      as: "team",
      required: true
    }]
  });
  if (!user) {
    throw new _errors.AuthenticationError("Invalid user");
  }
  (0, _policies.can)(user, "read", user);
  socket.client.user = user;
  // Add a listener for this user to the individual room so they can be notified
  // when their account is required to re-authenticate.
  socket.join(\`user-\${user.id}\`);
  socket.join(\`team-\${user.teamId}\`);
  // join rooms for any documents the user is already subscribed to in memory
  // these will be different on each server instance
  const processor = new _WebsocketsProcessor.default();
  const subscriptions = processor.getSubscriptionsForUser(user.id);
  subscriptions === null || subscriptions === void 0 ? void 0 : subscriptions.forEach(documentId => socket.join(documentId));
  // broadcast to the individual room that this user just connected. Other
  // servers in the cluster will be listening and can act on this information.
  socket.broadcast.to(\`user-\${user.id}\`).emit("user.connect", {
    userId: user.id,
    socketId: socket.id,
    serverId: _env.default.SERVER_ID
  });
  (0, _queues.schedule)({
    name: "ValidateSSOAccessTask",
    opts: {
      attempts: 1
    },
    data: {
      userId: user.id
    }
  });
}
`;

fs.writeFileSync(websocketFile, fixedCode);
console.log('WebSocket file fixed correctly for TUSUR');