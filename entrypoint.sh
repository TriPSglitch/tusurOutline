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

# Запускаем Outline
echo "Запуск Outline..."
exec node ./build/server/index.js