FROM outlinewiki/outline:latest

# Устанавливаем зависимости для работы с Redis
USER root
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Находим каталог Outline
RUN echo "Outline найден в: /opt/ouline" && \
    echo "Содержимое в /opt/outline:" && \
    ls -la /opt/outline/

# Создаем директорию для плагина
RUN mkdir -p /opt/outline/plugins/tusur-warden

# Копируем плагин
COPY outline-tusur-warden-plugin/src/ /opt/outline/plugins/tusur-warden/

# Создаем config директорию
RUN mkdir -p /opt/outline/config/tusur
COPY outline-tusur-warden-plugin/config/tusur.json /opt/outline/config/tusur

COPY plugins.json /opt/outline/config/

# Создаем package.json для плагина
RUN echo '{\
  "name": "outline-tusur-warden-plugin",\
  "version": "1.0.0",\
  "main": "index.js"\
}' > /opt/outline/plugins/tusur-warden/package.json

# Устанавливаем зависимости плагина
WORKDIR /opt/outline/plugins/tusur-warden
RUN npm install ioredis @koa/router

# Копируем patch файл
COPY patch-server.js /tmp/patch-server.js
COPY patch-websocket-origin.js /tmp/patch-websocket-origin.js
COPY socket-io-auth-patch.js /tmp/socket-io-auth-patch.js
COPY websocket-token-patch.js /tmp/websocket-token-patch.js
COPY websocket-fix-patch.js /tmp/websocket-fix-patch.js
COPY websocket-origin-fix.js /tmp/websocket-origin-fix.js
COPY websocket-simple-fix.js /tmp/websocket-simple-fix.js
COPY websocket-engine-fix.js /websocket-engine-fix.js

# Патчим сервер
RUN node /tmp/patch-server.js
RUN node /tmp/patch-websocket-origin.js
RUN node /tmp/socket-io-auth-patch.js
RUN node /tmp/websocket-token-patch.js
RUN node /tmp/websocket-fix-patch.js
RUN node /tmp/websocket-origin-fix.js
RUN node /tmp/websocket-simple-fix.js
RUN node /tmp/websocket-engine-fix.js

# Копируем entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Возврашаем права пользователю outline
RUN chown -R node:node /opt/outline/plugins/tusur-warden

# Возвращаемся в рабчую директорию
WORKDIR /opt/outline
USER node

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
