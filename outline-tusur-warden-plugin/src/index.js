const TusurRedisClient = require('./redis-client');
const WardenMiddleware = require('./warden-middleware');
const AuthRoutes = require('./auth-routes');

class TusurWardenPlugin {
  constructor() {
    this.id = 'tusur-warden-plugin';
    this.name = 'TUSUR Warden Integration';
    this.description = 'Интеграция Outline с системой авторизации ТУСУР warden';
    this.version = '1.0.0';

    this.config = null;
    this.redis = null;
    this.middleware = null;
    this.routes = null;
  }

  async activate(manager) {
    console.log('[TUSUR Plugin] Активация плагина...');

    // Проверяем, не активирован ли уже плагин
    if (this._activated) {
      console.log('[TUSUR Plugin] Плагин уже активирован, пропускаем');
      return;
    }

    this.manager = manager;

    // Загружаем конфигурацию
    this.config = this.loadConfig();

    // Инициализируем Redis клиент
    this.redis = new TusurRedisClient(this.config.redis);

    // Инициализируем компоненты
    this.middleware = new WardenMiddleware(this);
    this.routes = new AuthRoutes(this);

    console.log('[TUSUR Plugin] Manager has app: ' + (manager.app ? 'YES' : 'NO'));

    // Активируем компоненты
    await this.middleware.activate(manager);
    await this.routes.activate(manager);

    this._activated = true;

    this.middleware = this.middleware;

    console.log('[TUSUR Plugin] Плагин успешно активирован');
    console.log('[TUSUR Plugin] Домен Outline:', this.config.outlineDomain);
    console.log('[TUSUR Plugin] Redis хост:', this.config.redis.host);
  }

  async deactivate() {
    console.log('[TUSUR Plugin] Деактивация...');

    if (this.middleware) {
      await this.middleware.deactivate();
    }

    if (this.redis) {
      await this.redis.disconnect();
    }

    console.log('[TUSUR Plugin] Деактивирован');
  }

  loadConfig() {
    return {
      outlineDomain: process.env.URL || 'https://outline-docs.tusur.ru',
      forceHttps: process.env.FORCE_HTTPS === 'true',
      debug: process.env.NODE_ENV !== 'production',

      redis: {
        host: process.env.TUSUR_REDIS_HOST || 'redis.tusur.ru',
        port: parseInt(process.env.TUSUR_REDIS_PORT) || 6379,
        password: process.env.TUSUR_REDIS_PASSWORD || '',
        sessionDb: 4,
        userDb: 3
      },

      warden: {
        loginUrl: 'https://profile.tusur.ru/users/sign_in',
        logoutUrl: 'https://profile.tusur.ru/users/sign_out'
      }
    };
  }

  getSettings() {
    return [
      {
        key: 'enabled',
        type: 'boolean',
        label: 'Включить интеграцию с TUSUR',
        defaultValue: true
      },
      {
        key: 'redisHost',
        type: 'string',
        label: 'Redis хост ТУСУР',
        defaultValue: 'redis.tusur.ru'
      },
      {
        key: 'debug',
        type: 'boolean',
        label: 'Режим отладки',
        defaultValue: false
      }
    ];
  }
}

module.exports = TusurWardenPlugin;
