const url = require('url');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class WardenMiddleware {
  constructor(plugin) {
    this.plugin = plugin;
    this.config = null;
    this.redis = null;
    this.manager = null;
    this._registered = false;
  }

  /**
   * Активация плагина и регистрация middleware в приложении Outline
   */
  async activate(manager) {
    if (this._registered) {
      console.log('[TUSUR Warden] Middleware уже зарегистрирован, пропускаем');
      return;
    }

    this.manager = manager;
    this.config = this.plugin.config;
    this.redis = this.plugin.redis;

    console.log(`[TUSUR Warden] Активация middleware (PID: ${process.pid})`);

    // Подключение к Redis ТУСУР
    const connected = await this.redis.connect();
    if (!connected) {
      throw new Error('Не удалось подключиться к Redis ТУСУР');
    }

    if (manager.app && typeof manager.app.use === 'function') {
      manager.app.use(this.createMiddleware());
      this._registered = true;
      console.log('[TUSUR Warden] Middleware успешно внедрен в Koa');
    } else {
      console.error('[TUSUR Warden] Ошибка: manager.app.use не доступен');
    }
  }

  /**
   * Деактивация плагина
   */
  async deactivate() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    console.log('[TUSUR Warden] Middleware деактивирован');
  }

  /**
   * Основной обработчик запросов (Middleware)
   */
  createMiddleware() {
    const processedContexts = new WeakSet();

    return async (ctx, next) => {
      const path = ctx.path;
      const method = ctx.method;

      // 1. Обработка WebSocket (Realtime / Collaboration)
      if (path.startsWith('/realtime') || path.includes('/collaboration')) {
        const token = ctx.cookies.get('accessToken') || ctx.query.accessToken;

        if (token) {
          ctx.query.accessToken = token;
          ctx.headers['authorization'] = `Bearer ${token}`;

          // Пробрасываем токен в URL для Socket.io, если его там еще нет
          if (!ctx.req.url.includes('accessToken=')) {
            const separator = ctx.req.url.includes('?') ? '&' : '?';
            ctx.req.url += `${separator}accessToken=${token}`;
          }
        }
        return next();
      }

      // Защита от повторной обработки одного и того же запроса
      if (processedContexts.has(ctx)) return next();
      processedContexts.add(ctx);

      // Пропускаем OPTIONS
      if (method === 'OPTIONS') return next();

      // 2. Определение публичных путей
      const publicPaths = [
        '/auth',
        '/auth/',
        '/auth/tusur',
        '/auth/tusur/callback',
        '/auth/tusur/debug',
        '/auth/tusur/test',
        '/auth/debug/session',
        '/login',
        '/healthz',
        '/robots.txt',
        '/favicon.ico',
        '/static',
        '/api/auth.config',
        '/api/attachments.redirect',
        '/api/auth.delete'
      ];

      if (this.isPathPublic(path, publicPaths)) {
        return next();
      }

      // 3. Проверка существующей сессии Outline
      const tokenUser = await this.validateExistingAccessToken(ctx);
      if (tokenUser) {
        ctx.state.user = tokenUser;
        return next();
      }

      // 4. Попытка авторизации через Warden (Redis)
      const wardenUser = await this.getWardenUser(ctx);
      if (wardenUser) {
        const outlineUser = await this.syncUserWithOutline(ctx, wardenUser);
        if (outlineUser) {
          return next();
        }
      }

      // 5. Если доступа нет: API возвращает 401, Веб — редирект на Warden
      if (path.startsWith('/api/')) {
        ctx.status = 401;
        ctx.body = { error: 'authentication_required' };
      } else {
        console.log(`[TUSUR Auth] Редирект на авторизацию: ${path}`);
        return this.redirectToWarden(ctx);
      }
    };
  }

  /**
   * Проверка, является ли путь общедоступным
   */
  isPathPublic(path, publicPaths) {
    if (publicPaths.some(p => path.startsWith(p))) {
      // Исключение: API запросы (кроме auth) требуют проверки
      if (path.startsWith('/api/') && !path.startsWith('/api/auth')) {
        return false;
      }
      return true;
    }
    // Проверка статических расширений
    const staticExts = ['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.woff2'];
    return staticExts.some(ext => path.endsWith(ext));
  }

  /**
   * Получение данных пользователя из сессии Warden (Redis ТУСУР)
   */
  async getWardenUser(ctx) {
    try {
      const sessionId = this.redis.getSessionIdFromCookies(ctx);
      if (!sessionId) return null;

      const isActive = await this.redis.isSessionActive(sessionId);
      if (!isActive) return null;

      const userId = await this.redis.getUserIdFromSession(sessionId);
      if (!userId) return null;

      return await this.redis.getUserData(userId);
    } catch (error) {
      console.error('[TUSUR Warden] Ошибка получения данных из Redis:', error);
      return null;
    }
  }

  /**
   * Синхронизация пользователя Warden с базой данных Outline
   */
  async syncUserWithOutline(ctx, wardenUser) {
    try {
      const User = this.manager.models?.User;
      const Team = this.manager.models?.Team;

      if (!User || !Team) return null;

      let outlineUser = await User.findOne({ where: { email: wardenUser.email } });

      // Если пользователя нет — создаем его
      if (!outlineUser) {
        const team = await Team.findOne();
        outlineUser = await User.create({
          email: wardenUser.email,
          name: wardenUser.full_name || wardenUser.name || wardenUser.email.split('@')[0],
          teamId: team.id,
          role: 'admin', // Или ваша логика ролей
          lastActiveAt: new Date()
        });
        console.log(`[TUSUR Sync] Создан новый пользователь: ${outlineUser.email}`);
      }

      // Проверка/генерация секретного ключа JWT (обязательно для Outline)
      if (!outlineUser.jwtSecret && typeof outlineUser.rotateJwtSecret === 'function') {
        await outlineUser.rotateJwtSecret();
        await outlineUser.reload();
      }

      // Генерация токенов
      const accessToken = this.createOutlineAccessToken(outlineUser);

      // Установка сессии и кук
      await this.integrateWithOutlineSession(ctx, outlineUser, accessToken);

      ctx.state.user = outlineUser;
      ctx.state.authToken = accessToken;

      return outlineUser;
    } catch (error) {
      console.error('[TUSUR Sync] Ошибка синхронизации:', error);
      return null;
    }
  }

  /**
   * Создание полноценной сессии в стиле Outline
   */
  async integrateWithOutlineSession(ctx, outlineUser, accessToken) {
    const domain = '.outline-docs.tusur.ru';
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней

    // 1. Устанавливаем accessToken (для API и WS)
    ctx.cookies.set('accessToken', accessToken, {
      httpOnly: false,
      secure: this.config.forceHttps,
      sameSite: 'lax',
      maxAge,
      domain,
      path: '/'
    });

    // 2. Создаем системную сессию (connect.sid)
    const sessionId = crypto.randomBytes(32).toString('hex');
    const signature = this.signSessionToken(sessionId);
    const signedSession = `s:${sessionId}.${signature}`;

    ctx.cookies.set('connect.sid', signedSession, {
      httpOnly: true,
      secure: this.config.forceHttps,
      sameSite: 'lax',
      maxAge,
      domain,
      path: '/'
    });

    // 3. Синхронизация с Passport.js (если используется)
    if (ctx.session) {
      ctx.session.userId = outlineUser.id;
      ctx.session.passport = { user: outlineUser.id };
    }
  }

  /**
   * Подпись токена сессии аналогично koa-session / Outline
   */
  signSessionToken(token) {
    const secret = process.env.SECRET_KEY;
    if (!secret) return '';

    return crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Создание JWT токена через встроенные методы модели User
   */
  createOutlineAccessToken(user) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Пытаемся вызвать нативный метод Outline
    if (typeof user.getJwtToken === 'function') {
      return user.getJwtToken(expiresAt);
    }

    // Если метод недоступен (например, при кастомной сборке), создаем вручную
    const payload = {
      id: user.id,
      expiresAt: expiresAt.toISOString(),
      type: "session"
    };

    return jwt.sign(payload, user.jwtSecret, { algorithm: 'HS256' });
  }

  /**
   * Проверка валидности уже имеющегося accessToken
   */
  async validateExistingAccessToken(ctx) {
    const token = ctx.cookies.get('accessToken');
    if (!token) return null;

    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.id) return null;

      const User = this.manager.models?.User;
      const user = await User.findOne({ where: { id: decoded.id } });

      if (!user || !user.jwtSecret) return null;

      // Проверка подписи токена
      jwt.verify(token, user.jwtSecret);
      return user;
    } catch (e) {
      return null;
    }
  }

  /**
   * Редирект на внешний сервер авторизации (Warden)
   */
  redirectToWarden(ctx) {
    const currentUrl = ctx.request.href;
    const returnTo = encodeURIComponent(currentUrl);

    // Формируем URL для warden
    const wardenUrl = this.buildWardenRedirectUrl(returnTo);

    if (this.config.debug) {
      console.log(`[TUSUR Auth] Редирект на warden: ${wardenUrl}`);
    }

    // Сохраняем оригинальный URL для возврата
    ctx.cookies.set('tusur_return_to', returnTo, {
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 минут
      sameSite: 'lax',
      secure: this.config.forceHttps
    });

    // Перенаправляем
    ctx.redirect(wardenUrl);
  }
}

module.exports = WardenMiddleware;