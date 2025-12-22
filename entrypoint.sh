#!/bin/sh
set -e

echo "=== Запуск Outline с TUSUR плагином ==="
echo "Текущая директория: $(pwd)"

# Проверяем WebSocket настройки
echo "Проверка WebSocket настроек..."
echo "WEBSOCKET_URL=${WEBSOCKET_URL}"
echo "COLLABORATION_URL=${COLLABORATION_URL}"
echo "REALTIME_URL=${REALTIME_URL}"
echo "ALLOWED_WEBSOCKET_ORIGINS=${ALLOWED_WEBSOCKET_ORIGINS}"

# Проверяем существование плагина
if [ -f "plugins/tusur-warden/index.js" ]; then
    echo "TUSUR плагин найден"
else
    echo "TUSUR плагин не найден, проверяем альтернативные пути..."
    find . -name "tusur-warden" -type d 2>/dev/null || true
fi

# Всегда применяем патчи для уверенности
echo "Применение патчей..."
if [ -f "/tmp/patch-server.js" ]; then
    node /tmp/patch-server.js
else
    echo "patch-server.js не найден"
fi

if [ -f "/tmp/socket-io-auth-patch.js" ]; then
    node /tmp/socket-io-auth-patch.js
fi

if [ -f "/tmp/websocket-token-patch.js" ]; then
    node /tmp/websocket-token-patch.js
fi

# Проверяем синтаксис
echo "Проверка синтаксиса серверного файла..."
if node -c ./build/server/index.js; then
    echo "Синтаксис серверного файла корректен"
else
    echo "ОШИБКА: Синтаксис серверного файла некорректен!"
    exit 1
fi

# Проверяем патч
echo "Проверка патча в server/index.js:"
if grep -q "TUSUR_PATCH_APPLIED" ./build/server/index.js; then
    echo "✓ TUSUR патч найден"
else
    echo "✗ TUSUR патч не найден"
fi

# Проверяем WebSocket патчи
echo "Проверка WebSocket патчей..."
if grep -q "TUSUR_WEBSOCKET_FIX" ./build/server/websockets/index.js; then
    echo "✓ WebSocket fix найден"
else
    echo "✗ WebSocket fix не найден"
fi

# Запускаем Outline
echo "Запуск Outline..."
exec node ./build/server/index.js