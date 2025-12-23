#!/bin/sh
set -e

echo "=== Запуск Outline с TUSUR плагином ==="
echo "Текущая директория: $(pwd)"
echo "User: $(whoami)"
echo "UID: $(id -u)"
echo "GID: $(id -g)"

# Проверяем права
ls -la /opt/outline/build/server/websockets/ 2>/dev/null || echo "WebSocket directory not found"

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
if [ -f "/opt/outline/build/server/websockets/index.js" ]; then
    echo "WebSocket file found"
elif [ -f "/opt/outline/build/server/services/websockets.js" ]; then
    echo "Legacy WebSocket file found"
else
    echo "WARNING: No WebSocket file found"
fi

# Запускаем Outline
echo "Запуск Outline..."
exec node ./build/server/index.js