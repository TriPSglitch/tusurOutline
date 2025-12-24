FROM outlinewiki/outline:latest

# Устанавливаем зависимости для работы с Redis
USER root
RUN apt-get update && \
    apt-get install -y python3 make g++ net-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Находим каталог Outline
RUN echo "Outline найден в: /opt/outline" && \
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

# Возвращаемся в основную директорию
WORKDIR /opt/outline

# Копируем исправленный патч WebSocket

# Копируем patch файлы
COPY patch-server.js /tmp/patch-server.js
COPY fix-env.js /tmp/fix-env.js
COPY fix-websocket-correct.js /tmp/fix-websocket-correct.js
COPY patch-websocket-final.js /tmp/patch-websocket-final.js
COPY patch-engineio-complete.js /tmp/patch-engineio-complete.js
COPY fix-broken-socketio.js /tmp/fix-broken-socketio.js

RUN node /tmp/patch-server.js
RUN node /tmp/fix-env.js
RUN node /tmp/fix-websocket-correct.js
RUN node /tmp/patch-websocket-final.js
RUN node /tmp/patch-engineio-complete.js
RUN node /tmp/fix-broken-socketio.js

# Копируем entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Возвращаем права пользователю outline
RUN chown -R node:node /opt/outline/plugins/tusur-warden

# Возвращаемся в рабочую директорию
WORKDIR /opt/outline
USER node

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]