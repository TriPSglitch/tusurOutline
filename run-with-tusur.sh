#!/bin/bash

# Экспортируем переменные окружения
export TUSUR_REDIS_IP="88.204.75.155"
export SECRET_KEY="ec1e220d522db0a2d4d3d4ece31f0b372d44b33dd02ebd070cbb0691832eea31"
export UTILS_SECRET="9c945224da5f17bd0fa9958c5835e06cf3b9cb7a75e2ad1a0773e54910cb8e9d"

# Перезапускаем nginx
sudo nginx -t
sudo systemctl reload nginx

# Останавливаем и удаляем старые контейнеры
sudo docker-compose -f docker-compose.yml -f docker-compose.override.yml down                                      # 
sudo docker rmi outline_outline outlinewiki/outline:latest 2>/dev/null || true
sudo docker volume prune -f

# Собираем кастомный образ Outline
sudo docker-compose -f docker-compose.yml -f docker-compose.override.yml build                                     #

# Запускаем
sudo docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d                                     #

# Проверяем логи
sudo docker-compose logs -f outline
