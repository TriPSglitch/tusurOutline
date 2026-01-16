const Redis = require('ioredis');

class TusurRedisClient {
  constructor(config) {
    this.config = config;
    this.sessionRedis = null;
    this.userRedis = null;
  }

  async connect() {
    try {
      console.log('[TUSUR Redis] Подключение к Redis:', this.config);

      // Проверяем конфигурацию
      if (!this.config || !this.config.host) {
        console.error('[TUSUR Redis] Неверная конфигурация:', this.config);
        return false;
      }

      // Подключаемся к Redis для сессий (база 4)
      this.sessionRedis = new Redis({
        host: this.config.host,
        port: this.config.port || 6379,
        db: this.config.sessionDb || 4, // База для сессий
        password: this.config.password || '',
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // Подключаемся к Redis для пользователей (база 3)
      this.userRedis = new Redis({
        host: this.config.host,
        port: this.config.port || 6379,
        db: this.config.userDb || 3, // База для пользователей
        password: this.config.password || '',
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // Проверяем подключение
      await Promise.all([
        this.sessionRedis.ping(),
        this.userRedis.ping()
      ]);

      console.log('[TUSUR Redis] Успешное подключение к Redis ТУСУР');
      return true;
    } catch (error) {
      console.error('[TUSUR Redis] Ошибка подключения:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.sessionRedis) {
      await this.sessionRedis.quit();
    }
    if (this.userRedis) {
      await this.userRedis.quit();
    }
  }
  
  // Получаем session_id из куков
  getSessionIdFromCookies(ctx) {
    return ctx.cookies.get('_session_id');
  }
  
  // Получаем user_id из сессии Redis
  async getUserIdFromSession(sessionId) {
    console.log('[TUSUR Redis DEBUG] Getting user ID for session: ' + sessionId);
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.sessionRedis.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      // Парсим данные сессии
      let parsedSession;
      try {
        parsedSession = JSON.parse(sessionData);
      } catch (e) {
        // Если не JSON, пробуем десериализовать как Rails session
        parsedSession = this.parseRailsSession(sessionData);
      }

      // Извлекаем user_id из структуры warden
      if (parsedSession && parsedSession['warden.user.user.key']) {
        const wardenData = parsedSession['warden.user.user.key'];
        if (Array.isArray(wardenData) && wardenData.length > 0) {
          const userIdArray = wardenData[0];
          if (Array.isArray(userIdArray) && userIdArray.length > 0) {
            return userIdArray[0].toString(); // Конвертируем в строку
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[TUSUR Redis] Ошибка получения user_id:', error);
      return null;
    }
  }
  
  // Парсинг Rails сессии (альтернативный формат)
  parseRailsSession(sessionData) {
    try {
      // Пробуем разные форматы сериализации
      if (sessionData.startsWith('---')) {
        // Ruby Marshal format (упрощенный парсинг)
        const match = sessionData.match(/user_id:\s*(\d+)/);
        if (match) {
          return { 'warden.user.user.key': [[match[1]]] };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Получаем данные пользователя из Redis
  async getUserData(userId) {
    try {
      const userKey = `user:${userId}`;

      // Получаем все поля пользователя
      const userData = await this.userRedis.hgetall(userKey);
      if (!userData || Object.keys(userData).length === 0) {
        return null;
      }

      // Преобразуем данные в удобный формат
      const data = this.normalizeUserData(userData);
      data.id = userId;
      return data;
    } catch (error) {
      console.error('[TUSUR Redis] Ошибка получения данных пользователя:', error);
      return null;
    }
  }

  // Нормализация данных пользователя из Redis
  normalizeUserData(redisData) {
    const user = {};

    // Базовые поля
    // user.id = redisData.user_id || '';
    user.surname = redisData.surname || '';
    user.name = redisData.name || '';
    user.patronymic = redisData.patronymic || '';
    user.email = redisData.email || '';
    user.avatar_url = redisData.avatar_url || '';

    // Статистика
    user.last_sign_in_at = redisData.last_sign_in_at || null;
    user.created_at = redisData.created_at || null;

    // Генерируем полное имя
    user.full_name = [user.surname, user.name, user.patronymic]
      .filter(Boolean)
      .join(' ');

    // Генерируем username из email
    user.username = user.email.split('@')[0] || `user_${user.id}`;

    return user;
  }

  // Проверяем, активна ли сессия
  async isSessionActive(sessionId) {
    try {
      const key = `session:${sessionId}`;
      const exists = await this.sessionRedis.exists(key);

      if (!exists) {
        return false;
      }

      const ttl = await this.sessionRedis.ttl(key);
      return ttl > 0;
    } catch (error) {
      console.log('[TUSUR Redis] Ошибка проверки сессии:', error);
      return false;
    }
  }

  // Обновляем время последней активности в сервисе
  async updateServiceActivity(userId, serviceName) {
    try {
      const serviceKey = `user:${userId}:services`;
      const activityData = {
        service: serviceName,
        last_active_at: new Date().toISOString(),
        service_url: 'https://outline-docs.tusur.ru'
      };

      await this.userRedis.hset(
        serviceKey,
        'outline',
        JSON.stringify(activityData)
      );

      return true;
    } catch (error) {
      console.error('[TUSUR Redis] Ошибка обновления активности:', error);
      return false;
    }
  }
}

module.exports = TusurRedisClient;
