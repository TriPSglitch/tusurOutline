#!/bin/bash

# Перезапускаем nginx
sudo nginx -t
sudo systemctl reload nginx

# Останавливаем и удаляем старые контейнеры
sudo docker-compose -f docker-compose.yml down
sudo docker rmi outline_outline outlinewiki/outline:latest 2>/dev/null || true
sudo docker volume prune -f

# Собираем кастомный образ Outline
sudo docker-compose -f docker-compose.yml build

# Запускаем
sudo docker-compose -f docker-compose.yml up -d

# Проверяем логи
sudo docker-compose logs -f outline
