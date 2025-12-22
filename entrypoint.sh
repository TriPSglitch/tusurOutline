#!/bin/sh
set -e

echo "=== Запуск Outline с TUSUR плагином ==="
echo "Текущая директория: $(pwd)"
echo "User: $(whoami)"
echo "UID: $(id -u)"
echo "GID: $(id -g)"

# Проверяем права
ls -la /opt/outline/build/server/websockets/ 2>/dev/null || echo "WebSocket directory not found"

# Проверяем WebSocket настройки
echo "Проверка WebSocket настроек..."
env | grep -i "websocket\|socket\|collaboration\|realtime" | sort

# Всегда применяем финальный патч WebSocket
if [ -f "/tmp/websocket-engine-final.js" ]; then
    echo "Применение финального WebSocket патча..."
    node /tmp/websocket-engine-final.js
else
    echo "Финальный WebSocket патч не найден"
fi

# Проверяем существование плагина
if [ -f "plugins/tusur-warden/index.js" ]; then
    echo "TUSUR плагин найден"
else
    echo "TUSUR плагин не найден"
fi

# Проверяем синтаксис серверного файла
echo "Проверка синтаксиса серверного файла..."
if node -c ./build/server/index.js; then
    echo "Синтаксис серверного файла корректен"
else
    echo "ОШИБКА: Синтаксис серверного файла некорректен!"
    exit 1
fi

# Проверяем WebSocket файл
echo "Проверка WebSocket файла..."
if [ -f "./build/server/websockets/index.js" ]; then
    echo "WebSocket файл найден"
    head -20 ./build/server/websockets/index.js
    if node -c ./build/server/websockets/index.js; then
        echo "Синтаксис WebSocket файла корректен"
    else
        echo "ОШИБКА: Синтаксис WebSocket файла некорректен!"
    fi
else
    echo "WebSocket файл не найден"
fi

# Запускаем Outline
echo "Запуск Outline..."
exec node ./build/server/index.js