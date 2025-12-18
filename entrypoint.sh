#!/bin/sh
set -e

echo "=== Запуск Outline с TUSUR плагином ==="
echo "Текущая директория: $(pwd)"

echo "Содержимое plugins:"
ls -la plugins/ || echo "Директория plugins не существует"

# Проверяем существование плагина
if [ -f "plugins/tusur-warden/index.js" ]; then
    echo "TUSUR плагин найден"
else
    echo "TUSUR плагин не найден"
    ls -la  plugins/ 2>/dev/null || true
fi

# Проверяем патч
echo "Проверка патча в server/index.js:"
if grep -q "TUSUR_PATCH_APPLIED" /opt/outline/build/server/index.js; then
    echo "Патч найден"
else
    echo "Патч не найден"

    # Применяем патч вручную
    echo "Применение патча вручную"
    node /tmp/patch-server.js 2>&1 || "Не удалось применить патч"
fi

# Запускаем Outline
echo "Запуск Outline..."
exec node ./build/server/index.js
