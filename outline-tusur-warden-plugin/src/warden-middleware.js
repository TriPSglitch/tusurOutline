const url = require('url');

class WardenMiddleware {
  constructor(plugin) {
    this.plugin = plugin;
    this.config = null;
    this.redis = null;
  }

  async activate(manager) {
    if (this._registered) {
      console.log('[TUSUR Warden Middleware] Middleware уже зарегистрирован, пропускаем');
      return;
    }

    this.manager = manager;
    this.config = this.plugin.config;
    this.redis = this.plugin.redis;

    console.log('[TUSUR Warden Middleware] Активация middleware in PID:', process.pid);

    // Подключаемся к Redis
    const connected = await this.redis.connect();
    if (!connected) {
      throw new Error('Не удалось подключиться к Redis ТУСУР');
    }

    if (manager.app && typeof manager.app.use === 'function') {
      manager.app.use(this.createMiddleware());
      this._registred = true;
      console.log('[TUSUR Warden Middleware] Middleware зарегистрирован');
    } else {
      console.error('[TUSUR DEBUG] Cannot register middleware: app or app.use not available');
    }

    console.log('[TUSUR Warden Middleware] Middleware зарегестрирован');
  }

  async deactivate() {
    if (this.redis) {
      await this.redis.disconnect();
    }
    console.log('[TUSUR Warden Middleware] Деактивирован');
  }

  createMiddleware() {
    // Используем WeakMap для отслеживания уже обработанных контекстов
    const processedContexts = new WeakSet();

    return async (ctx, next) => {
      // console.log(`[TUSUR DEBUG FULL] Запрос: ${ctx.method} ${ctx.path}`);
      // console.log(`[TUSUR DEBUG FULL] Headers:`, ctx.headers);
      // console.log(`[TUSUR DEBUG FULL] Query:`, ctx.query);
      // //      console.log(`[TUSUR DEBUG FULL] Cookies:`, ctx.cookies);
      // console.log(`[TUSUR DEBUG FULL] Upgrade header:`, ctx.headers.upgrade);

      // Если этот контекст уже обработан, пропускаем
      if (processedContexts.has(ctx)) {
        console.log(`[TUSUR Middleware] Контекст уже обработан, пропускаем: ${ctx.path}`);
        return next();
      }

      // Помечаем контекст как обработанный
      processedContexts.add(ctx);

      const path = ctx.path;
      const method = ctx.method;

      const requestKey = `${method}:${path}`;

      // Если пользователь уже установлен в этом запросе, пропускаем
      if (ctx.state.user && ctx.state.user._tusurProcessed) {
        console.log(`[TUSUR Middleware] Запрос уже обработан, пропускаем: ${requestKey}`);
        return next();
      }

      // Добавьте больше отладочной информации
      console.log(`[TUSUR AUTH ENTRY] Path: ${path}, Method: ${method}`);

      console.log(`[TUSUR Debug] === НАЧАЛО ЗАПРОСА ===`);

      if (ctx.state.user) {
        console.log(`[TUSUR Middleware] Пользователь уже установлен: ${ctx.state.user.email}`);
        return next();
      }

      // console.log(`[TUSUR Debug] Path: ${ctx.path}, Method: ${ctx.method}`);
      // console.log(`[TUSUR Debug] Cookies:`, {
      //   accessToken: ctx.cookies.get('accessToken') ? 'present' : 'missing',
      //   connectSid: ctx.cookies.get('connect.sid') ? 'present' : 'missing',
      //   sessionId: ctx.cookies.get('_session_id') ? 'present' : 'missing'
      // });

      // Проверьте заголовки авторизации
      // console.log(`[TUSUR Debug] Headers:`, {
      //   authorization: ctx.get('Authorization'),
      //   'x-user-id': ctx.get('X-User-Id'),
      //   'x-user-email': ctx.get('X-User-Email')
      // });

      // // Проверьте состояние контекста
      // console.log(`[TUSUR Debug] ctx.state.user:`, ctx.state.user ? ctx.state.user.email : 'null');
      // console.log(`[TUSUR Debug] ctx.session:`, ctx.session ? 'exists' : 'null');
      // console.log(`[TUSUR Debug] ctx.sessionStore:`, ctx.sessionStore ? 'exists' : 'null');

      // Пропускаем OPTIONS запросы
      if (method === 'OPTIONS') {
        return next();
      }

      if (path.startsWith('/realtime/') || path.startsWith('/collaboration/')) {
        console.log(`[TUSUR WebSocket] WebSocket запрос: ${path}`);

        // Получаем токен из cookies
        const accessToken = ctx.cookies.get('accessToken');

        if (accessToken) {
          console.log(`[TUSUR WebSocket] Найден accessToken: ${accessToken.substring(0, 30)}...`);

          // КРИТИЧЕСКИ ВАЖНО: устанавливаем токен в query параметры
          // Outline Socket.IO ищет токен в query, а не в cookies
          ctx.query.accessToken = accessToken;
          console.log(`[TUSUR WebSocket] Токен установлен в query: accessToken=${accessToken.substring(0, 20)}...`);

          // Также аутентифицируем пользователя
          const tokenUser = await this.validateWebSocketToken(accessToken);
          if (tokenUser) {
            console.log(`[TUSUR WebSocket] Пользователь авторизован: ${tokenUser.email}`);
            ctx.state.user = tokenUser;
            ctx.state.authToken = accessToken;

            // Устанавливаем заголовки
            ctx.set('X-User-Id', tokenUser.id);
            ctx.set('X-User-Email', tokenUser.email);
          }
        } else {
          console.log(`[TUSUR WebSocket] Нет accessToken в cookies`);
        }

        return next();
      }

      if (ctx.headers.upgrade && ctx.headers.upgrade.toLowerCase() === 'websocket') {
        console.log(`[TUSUR WebSocket] WebSocket запрос: ${ctx.path}`);

        // Получаем токен из cookies (основной способ)
        const accessToken = ctx.cookies.get('accessToken');

        if (accessToken) {
          console.log(`[TUSUR WebSocket] Найден accessToken: ${accessToken.substring(0, 30)}...`);

          // КРИТИЧЕСКИ ВАЖНО: Устанавливаем токен в query параметры
          // Outline Socket.IO ожидает токен в query
          ctx.query.accessToken = accessToken;

          // Также валидируем пользователя
          const tokenUser = await this.validateWebSocketToken(accessToken);
          if (tokenUser) {
            console.log(`[TUSUR WebSocket] Пользователь авторизован: ${tokenUser.email}`);
            ctx.state.user = tokenUser;
            ctx.state.authToken = accessToken;

            // Устанавливаем заголовки для WebSocket
            ctx.set('X-User-Id', tokenUser.id);
            ctx.set('X-User-Email', tokenUser.email);
          }
        } else {
          console.log(`[TUSUR WebSocket] Нет accessToken в cookies`);
        }

        return next();
      }

      // Расширенный список публичных путей
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
        '/api/auth.config', // auth.config - публичный
        '/api/attachments.redirect',
        '/api/auth.delete'
      ];

      // Проверяем, является ли путь публичным
      const isPublicPath = this.isPathPublic(path, publicPaths);

      if (isPublicPath) {
        // console.log(`[TUSUR Auth] Публичный путь: ${path}`);
        return next();
      }

      // ======= КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ =======
      // ПЕРВЫМ делом проверяем валидный accessToken
      console.log(`[TUSUR Auth] Проверка accessToken для защищенного пути: ${path}`);
      const tokenUser = await this.validateExistingAccessToken(ctx);

      if (tokenUser) {
        // Пользователь найден по токену, устанавливаем в контекст
        console.log(`[TUSUR Auth] Авторизован по accessToken: ${tokenUser.email}`);

        return next();
      }
      // ======= КОНЕЦ ИЗМЕНЕНИЯ =======

      // Если токена нет или он невалиден, проверяем warden
      console.log(`[TUSUR Auth] accessToken не найден или невалиден, проверяем warden`);

      console.log(`[TUSUR Debug] ctx.sessionStore доступен: ${!!ctx.sessionStore}`);
      console.log(`[TUSUR Debug] ctx.session доступен: ${!!ctx.session}`);

      // Если sessionStore не доступен, попробуйте получить его из app
      if (!ctx.sessionStore && this.manager.app && this.manager.app.context) {
        ctx.sessionStore = this.manager.app.context.sessionStore;
      }

      const wardenUser = await this.getWardenUser(ctx);

      if (wardenUser) {
        console.log(`[TUSUR Auth] Найден пользователь warden: ${wardenUser.email}`);
        const outlineUser = await this.syncUserWithOutline(ctx, wardenUser);
        if (outlineUser) {
          console.log(`[TUSUR Auth] Пользователь синхронизирован: ${outlineUser.email}`);
          return next();
        }
      }

      // Различная логика для API и веб-запросов
      if (path.startsWith('/api/')) {
        console.log(`[TUSUR Auth] API запрос без авторизации: ${path}`);
        // Пропускаем - Outline вернет 401
        return next();
      } else {
        // Веб-запрос - редиректим на warden
        console.log(`[TUSUR Auth] Веб-запрос не авторизован, редирект на warden`);
        return this.redirectToWarden(ctx);
      }

      if (ctx.path === '/api/auth.info') {
        console.log(`[TUSUR Auth Info] Запрос к auth.info`);
        console.log(`[TUSUR Auth Info] Cookies:`, {
          accessToken: ctx.cookies.get('accessToken') ? 'present' : 'missing',
          connectSid: ctx.cookies.get('connect.sid') ? 'present' : 'missing'
        });
        console.log(`[TUSUR Auth Info] ctx.state.user:`, ctx.state.user ? ctx.state.user.email : 'null');

        // Логируем заголовки
        console.log(`[TUSUR Auth Info] Headers:`, {
          authorization: ctx.get('Authorization'),
          'x-user-id': ctx.get('X-User-Id'),
          'x-user-email': ctx.get('X-User-Email')
        });
      }

      if (ctx.state.user) {
        // Помечаем пользователя как обработанного
        ctx.state.user._tusurProcessed = true;
        console.log(`[TUSUR Middleware] === КОНЕЦ ОБРАБОТКИ ${requestKey}, user: ${ctx.state.user.email} ===`);
      }

      await next();

    };
  }

  isPathPublic(path, publicPaths) {
    if (path.startsWith('/collaboration/')) {
      return false; // Требует аутентификации
    }
    /*
    // Пропускаем WebSocket запросы - они обрабатываются отдельно
    if (ctx.headers.upgrade && ctx.headers.upgrade.toLowerCase() === 'websocket') {
      return false; // Требует специальной обработки
    }
    
    // Добавьте /realtime/ в публичные пути или обрабатывайте отдельно
    if (path.startsWith('/realtime/')) {
      return false; // Обрабатывается в WebSocket секции
    }
    */

    // Точное совпадение
    if (publicPaths.includes(path)) {
      return true;
    }

    // Проверка префиксов
    for (const publicPath of publicPaths) {
      if (path.startsWith(publicPath)) {
        // Исключение: API пути должны проходить через аутентификацию
        if (path.startsWith('/api/') && !path.startsWith('/api/auth')) {
          return false;
        }
        return true;
      }
    }

    // Проверка статических файлов
    const staticExtensions = ['.csc', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    for (const ext of staticExtensions) {
      if (path.endsWith(ext)) {
        return true;
      }
    }

    return false;
  }

  async getWardenUser(ctx) {
    try {
      // Получаем session_id из куков
      const sessionId = this.redis.getSessionIdFromCookies(ctx);

      if (!sessionId) {
        if (this.config.debug) {
          console.log('[TUSUR Auth] session_id не найден в куках');
        }
        return null;
      }

      // Проверяем активность сессии
      const isActive = await this.redis.isSessionActive(sessionId);
      if (!isActive) {
        console.log('[TUSUR Auth] Сессия истекла или не активна');
        return null;
      }

      // Получаем user_id из сессии
      const userId = await this.redis.getUserIdFromSession(sessionId);
      if (!userId) {
        console.log('[TUSUR Auth] Не удалось получить user_id из сессии');
        return null;
      }

      // Получаем данные пользователя
      const userData = await this.redis.getUserData(userId);
      if (!userData) {
        console.log(`[TUSUR Auth] Не найдены данные пользователя ${userId}`);
        return null;
      }

      return userData;
    } catch (error) {
      console.error('[TUSUR Auth] Ошибка получения пользователя:', error);
      return null;
    }
  }

  async syncUserWithOutline(ctx, wardenUser) {

    const existingValidToken = await this.getValidExistingToken(ctx, wardenUser.email);
    if (existingValidToken && existingValidToken.user && existingValidToken.token) {
      console.log(`[TUSUR Sync] Используем существующий валидный токен для: ${wardenUser.email}`);

      // Устанавливаем пользователя в контекст
      ctx.state.user = existingValidToken.user;
      ctx.state.authToken = existingValidToken.token;

      // Устанавливаем куки (если их нет)
      if (!ctx.cookies.get('accessToken')) {
        ctx.cookies.set('accessToken', existingValidToken.token, {
          httpOnly: false,
          secure: this.config.forceHttps,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          domain: '.outline-docs.tusur.ru',
          path: '/'
        });
      }

      return existingValidToken.user;
    }

    try {
      console.log(`[TUSUR Sync] Начинаем синхронизацию для: ${wardenUser.email}`);
      console.log(`[TUSUR Sync DEBUG] ctx.session доступен: ${!!ctx.session}`);
      console.log(`[TUSUR Sync DEBUG] ctx.state.user перед установкой: ${ctx.state.user ? ctx.state.user.email : 'null'}`);

      const User = this.manager.models?.User;
      const Team = this.manager.models?.Team;

      if (!User || !Team) {
        console.error('[TUSUR Sync] Модели не найдены');
        return null;
      }

      // 1. Найти/создать пользователя (ваш существующий код)
      let outlineUser = await User.findOne({
        where: { email: wardenUser.email }
      });

      if (!outlineUser) {
        const team = await Team.findOne();
        if (!team) {
          console.error('[TUSUR Sync] Команда не найдена');
          return null;
        }

        outlineUser = await User.create({
          email: wardenUser.email,
          name: wardenUser.full_name || wardenUser.name || wardenUser.email.split('@')[0],
          teamId: team.id,
          role: 'admin',
          lastActiveAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`[TUSUR Sync] Пользователь создан: ${outlineUser.id}`);
      }

      console.log(`[TUSUR Sync] Проверка jwtSecret пользователя:`);
      console.log(`[TUSUR Sync] outlineUser.jwtSecret: ${outlineUser.jwtSecret ? 'присутствует' : 'отсутствует'}`);
      console.log(`[TUSUR Sync] outlineUser.get('jwtSecret'): ${outlineUser.get ? outlineUser.get('jwtSecret') ? 'присутствует' : 'отсутствует' : 'get метод не доступен'}`);

      // Если нет jwtSecret, возможно нужно его сгенерировать
      if (!outlineUser.jwtSecret && typeof outlineUser.rotateJwtSecret === 'function') {
        console.log(`[TUSUR Sync] Генерируем новый jwtSecret для пользователя`);
        await outlineUser.rotateJwtSecret();
        await outlineUser.reload(); // Перезагружаем, чтобы получить обновленный jwtSecret
      }

      // 1. НАСТРОЙКА СЕССИИ OUTLINE (КРИТИЧЕСКИ ВАЖНО)
      if (ctx.session) {
        ctx.session.userId = outlineUser.id;
        ctx.session.passport = { user: outlineUser.id };
        console.log(`[TUSUR Session] ctx.session установлен для пользователя: ${outlineUser.id}`);
      } else {
        console.error(`[TUSUR Session] ctx.session недоступен!`);
      }

      try {
        // Проверьте, есть ли passport в контексте
        if (ctx.login && typeof ctx.login === 'function') {
          console.log(`[TUSUR Passport] Пробуем ctx.login()`);

          await new Promise((resolve, reject) => {
            ctx.login(outlineUser, (err) => {
              if (err) {
                console.error('[TUSUR Passport] Ошибка ctx.login:', err);
                reject(err);
              } else {
                console.log('[TUSUR Passport] ctx.login успешен');
                resolve();
              }
            });
          });
        } else {
          console.log('[TUSUR Passport] ctx.login не доступен');
        }
      } catch (passportError) {
        console.error('[TUSUR Passport] Ошибка:', passportError);
      }

      // 2. Получить UserAuthentication для tokenId
      const UserAuthentication = this.manager.models?.UserAuthentication;
      let tokenId = `tusur-${Date.now()}`;

      if (UserAuthentication) {
        const userAuth = await UserAuthentication.findOne({
          where: { userId: outlineUser.id, providerId: 'tusur' }
        });
        if (userAuth) {
          tokenId = userAuth.id;
          console.log(`[TUSUR Sync] Используем UserAuthentication ID как tokenId: ${tokenId}`);

          // ОБНОВЛЯЕМ token в UserAuthentication!
          // Outline может проверять соответствие токена
          await userAuth.update({
            accessToken: Buffer.from(tokenId), // или что-то подобное
            lastValidatedAt: new Date()
          });
        }
      }

      // 3. Создать accessToken
      console.log(`[TUSUR Sync] Создаем accessToken`);
      const accessToken = this.createOutlineAccessToken(outlineUser);

      // 4. Создать collaboration токен для WebSocket
      console.log(`[TUSUR Sync] Создаем collaboration токен`);
      let collaborationToken;

      try {
        // Способ 1: Используем метод getCollaborationToken если есть
        if (typeof outlineUser.getCollaborationToken === 'function') {
          collaborationToken = outlineUser.getCollaborationToken();
          console.log(`[TUSUR Sync] Collaboration токен создан через getCollaborationToken`);
        } else {
          // Способ 2: Создаем вручную как Outline
          collaborationToken = this.createCollaborationToken(outlineUser);
          console.log(`[TUSUR Sync] Collaboration токен создан вручную`);
        }
      } catch (error) {
        console.error(`[TUSUR Sync] Ошибка создания collaboration токена: ${error.message}`);
        collaborationToken = accessToken; // Fallback
      }

      // 4. УСТАНОВИТЬ ACCESS_TOKEN COOKIE (КРИТИЧЕСКИ ВАЖНО!)
      ctx.cookies.set('accessToken', accessToken, {
        httpOnly: false,  // false — чтобы клиент мог читать токен
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 дней
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });
      console.log(`[TUSUR Token] Cookie accessToken установлена`);

      // 5. Сохранить accessToken где-нибудь для отладки/проверки
      // Например, в Redis ТУСУР

      /* await this.redis.sessionRedis.setex(
        `outline:user:${outlineUser.id}:accessToken`,
        7 * 24 * 60 * 60,
        JSON.stringify({
          token: accessToken,
          tokenId: tokenId,
          createdAt: new Date().toISOString()
        })
      );*/

      await this.redis.sessionRedis.setex(
        `outline:user:${outlineUser.id}:tokens`,
        7 * 24 * 60 * 60,
        JSON.stringify({
          accessToken: accessToken,
          collaborationToken: collaborationToken,
          createdAt: new Date().toISOString()
        })
      );

      console.log(`[TUSUR Sync] Установка куки connect.sid без sessionStore`);

      // Генерируем случайный sessionId
      const sessionId = require('crypto').randomBytes(32).toString('hex');

      // Создаем подпись как это делает koa-session
      const signature = this.signSessionToken(sessionId);
      const signedSession = `s:${sessionId}.${signature}`;

      // Устанавливаем куку
      ctx.cookies.set('connect.sid', signedSession, {
        httpOnly: true,
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      console.log(`[TUSUR Sync] Кука connect.sid установлена: ${signedSession.substring(0, 50)}...`);

      // 6. Также записать сессию в Redis ТУСУР (в вашу базу сессий)
      // Это поможет в отладке
      try {
        const sessionKey = `outline_session:${sessionId}`;
        const sessionData = JSON.stringify({
          userId: outlineUser.id,
          email: outlineUser.email,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });

        await this.redis.sessionRedis.setex(
          sessionKey,
          7 * 24 * 60 * 60, // 7 дней в секундах
          sessionData
        );
        console.log(`[TUSUR Sync] Сессия сохранена в Redis ТУСУР: ${sessionKey}`);
      } catch (redisError) {
        console.error('[TUSUR Sync] Ошибка сохранения сессии в Redis:', redisError);
      }

      if (outlineUser) {
        // 7. Установить заголовки для API запросов
        ctx.set('X-User-Id', outlineUser.id);
        ctx.set('X-User-Email', outlineUser.email);
        ctx.set('Authorization', `Bearer ${accessToken}`);

        // 8. Установить пользователя в ctx.state (у вас уже работает)
        ctx.state.user = outlineUser;
        ctx.state.authToken = accessToken;

        // 9. Также установить для совместимости с passport
        ctx.state.auth = {
          user: outlineUser,
          token: accessToken,
          type: 'authentication'
        };

        console.log(`[TUSUR Sync] Синхронизация успешно завершена для ${outlineUser.email}`);
        return outlineUser;
      }

    } catch (error) {
      console.error('[TUSUR Sync] Ошибка:', error);
      return null;
    }
  }

  async updateOutlineSession(ctx, user, accessToken) {
    try {
      console.log(`[TUSUR Session] Обновление сессии для: ${user.email}`);

      // 1. Устанавливаем accessToken куку
      ctx.cookies.set('accessToken', accessToken, {
        httpOnly: false,  // false - чтобы клиент мог читать
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      // 2. Создаем connect.sid куку (ОБЯЗАТЕЛЬНО для Outline!)
      const crypto = require('crypto');
      const sessionId = crypto.randomBytes(32).toString('hex');
      const signature = crypto.createHmac('sha256', process.env.UTILS_SECRET || process.env.SECRET_KEY)
        .update(sessionId)
        .digest('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const signedSession = `s:${sessionId}.${signature}`;

      ctx.cookies.set('connect.sid', signedSession, {
        httpOnly: true,
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      console.log(`[TUSUR Session] Кука connect.sid установлена`);

      // 3. Важно: Outline также проверяет наличие пользователя в req.user
      // Устанавливаем заголовки
      ctx.set('X-User-Id', user.id);
      ctx.set('X-User-Email', user.email);
      ctx.set('Authorization', `Bearer ${accessToken}`);

      console.log(`[TUSUR Session] Сессия обновлена, токен: ${accessToken.substring(0, 50)}...`);

    } catch (error) {
      console.error('[TUSUR Session] Ошибка обновления сессии:', error);
    }
  }

  async integrateWithOutlineSession(ctx, outlineUser) {
    try {
      console.log(`[TUSUR Session Integration] Начинаем интеграцию для: ${outlineUser.email}`);

      // 1. Найти или создать Session в базе данных
      const Session = this.manager.models?.Session;
      if (!Session) {
        console.log('[TUSUR Session] Модель Session не найдена');
        return;
      }

      // 2. Создаем запись сессии в БД
      const sessionToken = require('crypto').randomBytes(32).toString('hex');
      const session = await Session.create({
        userId: outlineUser.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
        ipAddress: ctx.ip || '127.0.0.1',
        userAgent: ctx.get('User-Agent') || 'TUSUR-Warden'
      });

      console.log(`[TUSUR Session] Сессия создана в БД: ${session.id}`);

      // 3. Создаем signed cookie для connect.sid
      const signature = this.signSessionToken(sessionToken);
      const signedSession = `s:${sessionToken}.${signature}`;

      // 4. Устанавливаем правильную куку connect.sid
      ctx.cookies.set('connect.sid', signedSession, {
        httpOnly: true,
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      console.log(`[TUSUR Session] Кука connect.sid установлена: ${signedSession.substring(0, 50)}...`);

      // 5. Устанавливаем сессию в ctx.session (если доступно)
      if (ctx.session) {
        ctx.session.userId = outlineUser.id;
        ctx.session.passport = { user: outlineUser.id };
        ctx.session.createdAt = new Date().toISOString();

        console.log(`[TUSUR Session] ctx.session обновлен`);
      }

      // 6. Также создаем accessToken для клиента
      const accessToken = this.createOutlineAccessToken(outlineUser, session.id);

      ctx.cookies.set('accessToken', accessToken, {
        httpOnly: false,  // false - чтобы клиент мог читать
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      console.log(`[TUSUR Session] accessToken установлен`);

    } catch (error) {
      console.error('[TUSUR Session Integration] Ошибка:', error.message);
    }
  }

  signSessionToken(token) {
    const crypto = require('crypto');

    // ВАЖНО: koa-session использует app.keys или keygrip
    // Outline использует SECRET_KEY для подписи сессий
    const secret = process.env.SECRET_KEY;

    if (!secret) {
      console.error('[TUSUR Sign] SECRET_KEY не найден');
      return '';
    }

    // koa-session использует Keygrip или похожий алгоритм
    // Попробуем простой HMAC как в документации koa-session
    const signature = crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('base64')
      .replace(/=+$/, '') // Убираем trailing =
      .replace(/\+/g, '-') // Заменяем + на -
      .replace(/\//g, '_'); // Заменяем / на _

    console.log(`[TUSUR Sign] Подпись создана (${signature.length} chars)`);
    return signature;
  }

  createOutlineAccessToken(user, tokenId) {
    try {
      console.log(`[TUSUR Token] Создание токена через user.getJwtToken для: ${user.email}`);

      // ПРАВИЛЬНЫЙ ВЫЗОВ: только expiresAt параметр
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      console.log(`[TUSUR Token] expiresAt: ${expiresAt}, тип: ${typeof expiresAt}`);

      const token = user.getJwtToken(expiresAt);
      console.log(`[TUSUR Token] Токен создан: ${token.substring(0, 50)}...`);

      // Проверим структуру токена
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        console.log(`[TUSUR Token] Декодированная структура:`, {
          id: decoded.id,
          type: decoded.type,
          expiresAt: decoded.expiresAt,
          iat: decoded.iat,
          exp: decoded.exp
        });
      } catch (e) {
        console.log(`[TUSUR Token] Не удалось декодировать токен: ${e.message}`);
      }

      return token;

    } catch (error) {
      console.error(`[TUSUR Token] Ошибка user.getJwtToken: ${error.message}`);

      // Fallback: создаем токен вручную как делает Outline
      return this.createOutlineStyleJWT(user);
    }
  }

  signSessionToken(token) {
    const crypto = require('crypto');
    const secret = process.env.UTILS_SECRET || process.env.SECRET_KEY;
    return crypto.createHmac('sha256', secret)
      .update(token)
      .digest('hex')
      .replace(/\=+$/, '');
  }

  async tryCreateDatabaseSession(ctx, outlineUser) {
    try {
      const Session = this.manager.models?.Session;
      if (!Session) {
        console.log('[TUSUR Session] Session model not available');
        return;
      }

      const crypto = require('crypto');
      const sessionToken = crypto.randomBytes(32).toString('hex');

      // Создаем сессию в базе данных
      const session = await Session.create({
        userId: outlineUser.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ctx.ip || '127.0.0.1',
        userAgent: ctx.get('User-Agent') || 'TUSUR-Warden'
      });

      console.log(`[TUSUR Session] Database session created: ${session.id}`);

      // Устанавливаем connect.sid куку
      ctx.cookies.set('connect.sid', `s:${sessionToken}`, {
        httpOnly: true,
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: 'outline-docs.tusur.ru',
        path: '/'
      });

    } catch (error) {
      console.error('[TUSUR Session] Error creating database session:', error.message);
    }
  }

  async createSessionInDatabase(ctx, user) {
    try {
      const Session = this.manager.models?.Session;
      if (!Session) {
        console.error('[TUSUR Session] Session model not found');
        return;
      }

      // Создаем запись сессии
      const session = await Session.create({
        userId: user.id,
        token: require('crypto').randomBytes(32).toString('hex'),
        expriseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: ctx.ip,
        userAgent: ctx.get('User-Agent')
      });

      console.log(`[TUSUR Session] Database sesion created: ${session.id}`);
    } catch (error) {
      console.error('[TUSUR Session] Error creating database session:', error);
    }
  }

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

  buildWardenRedirectUrl(returnTo) {
    const baseUrl = 'http://profile.tusur.ru/users/sign_in';
    const callbackUrl = `${this.config.outlineDomain}/auth/tusur/callback`;

    // Создаем URL согласно документации
    const redirectUrl = `${baseUrl}?redirect_url=${encodeURIComponent(callbackUrl)}?return_to=${returnTo}`;

    return redirectUrl;
  }

  async validateExistingAccessToken(ctx) {
    try {
      console.log(`[TUSUR Validate Token] Проверка токена для: ${ctx.path}`);

      const accessToken = ctx.cookies.get('accessToken');
      if (!accessToken) {
        console.log(`[TUSUR Validate Token] Токен не найден`);
        return null;
      }

      console.log(`[TUSUR Validate Token] Найден токен: ${accessToken.substring(0, 30)}...`);

      const jwt = require('jsonwebtoken');

      // Декодируем без проверки
      const decoded = jwt.decode(accessToken);
      if (!decoded || !decoded.id) {
        console.log(`[TUSUR Validate Token] Не могу декодировать токен или нет user.id`);
        return null;
      }

      console.log(`[TUSUR Validate Token] Декодирован: user=${decoded.id}, type=${decoded.type}`);

      // Находим пользователя
      const User = this.manager.models?.User;
      if (!User) {
        console.error(`[TUSUR Validate Token] Модель User не найдена`);
        return null;
      }

      const user = await User.findOne({
        where: { id: decoded.id }
      });

      if (!user) {
        console.log(`[TUSUR Validate Token] Пользователь ${decoded.id} не найден`);
        return null;
      }

      // Проверяем токен
      let isValid = false;

      if (user.jwtSecret) {
        try {
          jwt.verify(accessToken, user.jwtSecret, { algorithms: ['HS256'] });
          isValid = true;
          console.log(`[TUSUR Validate Token] Токен валиден с user.jwtSecret`);
        } catch (error) {
          console.log(`[TUSUR Validate Token] Не валиден с user.jwtSecret: ${error.message}`);
        }
      }

      if (!isValid) {
        // Проверяем, не истек ли токен
        let tokenExpired = false;

        if (decoded.exp) {
          const expiresAt = decoded.exp * 1000;
          if (Date.now() >= expiresAt) {
            tokenExpired = true;
            console.log(`[TUSUR Validate Token] Токен истек по exp`);
          }
        } else if (decoded.expiresAt) {
          const expiresAt = new Date(decoded.expiresAt).getTime();
          if (Date.now() >= expiresAt) {
            tokenExpired = true;
            console.log(`[TUSUR Validate Token] Токен истек по expiresAt`);
          }
        }

        if (!tokenExpired) {
          isValid = true;
          console.log(`[TUSUR Validate Token] Токен не истек, принимаем его`);
        }
      }

      if (isValid) {
        console.log(`[TUSUR Validate Token] Пользователь найден: ${user.email}`);
        ctx.state.user = user;
        ctx.state.authToken = accessToken;
        return user;
      }

      console.log(`[TUSUR Validate Token] Токен не валиден`);
      return null;

    } catch (error) {
      console.error(`[TUSUR Validate Token] Ошибка: ${error.message}`);
      return null;
    }
  }

  async validateTokenWithUser(user, token, tokenId) {
    try {
      // Outline НЕ хранит информацию о токенах в user_authentications
      // Вместо этого проверяем по providerId
      const UserAuthentication = this.manager.models?.UserAuthentication;
      if (UserAuthentication) {
        const auth = await UserAuthentication.findOne({
          where: {
            userId: user.id,
            providerId: 'tusur'  // Проверяем по providerId, а не по token
          }
        });

        return !!auth;
      }
      return true; // Если нет UserAuthentication, считаем валидным
    } catch (error) {
      console.error('[TUSUR Validate Token] Ошибка проверки токена:', error);
      return false;
    }
  }

  async createOutlineSessionInRedis(ctx, outlineUser) {
    try {
      console.log(`[TUSUR Redis Session] Создание сессии для: ${outlineUser.email}`);

      const sessionStore = ctx.sessionStore;
      if (!sessionStore) {
        console.error('[TUSUR Redis Session] sessionStore не найден в ctx');
        return null;
      }

      // Генерируем уникальный ID сессии
      const sessionId = require('crypto').randomBytes(32).toString('hex');

      // Создаем объект сессии, как ожидает koa-session
      const sessionData = {
        userId: outlineUser.id,
        passport: { user: outlineUser.id },
        cookie: {
          originalMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
          expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          secure: this.config.forceHttps,
          httpOnly: true,
          path: '/',
          domain: '.outline-docs.tusur.ru',
          sameSite: 'lax'
        },
        createdAt: new Date().toISOString(),
        views: 1
      };

      // Сохраняем сессию в Redis
      await new Promise((resolve, reject) => {
        sessionStore.set(sessionId, sessionData, (err) => {
          if (err) {
            console.error('[TUSUR Redis Session] Ошибка сохранения сессии:', err);
            reject(err);
          } else {
            console.log(`[TUSUR Redis Session] Сессия сохранена в Redis: ${sessionId.substring(0, 10)}...`);
            resolve();
          }
        });
      });

      // Устанавливаем куку connect.sid с ПРАВИЛЬНОЙ ПОДПИСЬЮ
      // Outline использует формат: s:{sessionId}.{signature}
      const signature = this.signSessionToken(sessionId);
      const signedSession = `s:${sessionId}.${signature}`;

      ctx.cookies.set('connect.sid', signedSession, {
        httpOnly: true,
        secure: this.config.forceHttps,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain: '.outline-docs.tusur.ru',
        path: '/'
      });

      console.log(`[TUSUR Redis Session] Кука connect.sid установлена: ${signedSession.substring(0, 50)}...`);

      return sessionId;

    } catch (error) {
      console.error('[TUSUR Redis Session] Ошибка создания сессии:', error);
      return null;
    }
  }

  createOutlineStyleJWT(user) {
    try {
      console.log(`[TUSUR JWT] Создание Outline-совместимого токена для: ${user.email}`);

      const jwt = require('jsonwebtoken');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // ВАЖНО: Точная структура как в Outline
      const payload = {
        id: user.id,
        expiresAt: expiresAt.toISOString(),  // ← строка ISO, не timestamp!
        type: "session"                      // ← тип "session"!
      };

      console.log(`[TUSUR JWT] Payload:`, payload);

      // КРИТИЧЕСКИ ВАЖНО: Используем user.jwtSecret, а не SECRET_KEY!
      if (!user.jwtSecret) {
        console.error(`[TUSUR JWT] У пользователя нет jwtSecret!`);

        // Попробуем получить из данных пользователя
        const jwtSecret = user.get ? user.get('jwtSecret') : null;
        if (!jwtSecret) {
          throw new Error('jwtSecret не найден у пользователя');
        }
      }

      const secret = user.jwtSecret;
      console.log(`[TUSUR JWT] Используем jwtSecret пользователя, длина: ${secret.length} байт`);

      const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
      console.log(`[TUSUR JWT] Токен создан: ${token.substring(0, 50)}...`);

      return token;

    } catch (error) {
      console.error(`[TUSUR JWT] Ошибка создания токена: ${error.message}`);

      // Крайний fallback: простой JWT с SECRET_KEY
      return this.createSimpleJWT(user);
    }
  }

  createSimpleJWT(user) {
    try {
      console.log(`[TUSUR Simple JWT] Создание простого JWT для: ${user.email}`);

      const jwt = require('jsonwebtoken');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Альтернативная структура, которую может принимать Outline
      const payload = {
        id: user.id,
        type: 'user',  // ← тип "user" вместо "session"
        tokenId: `tusur-${Date.now()}`,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      };

      // Используем SECRET_KEY как запасной вариант
      const secret = process.env.SECRET_KEY;
      if (!secret) {
        throw new Error('SECRET_KEY не найден');
      }

      const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
      console.log(`[TUSUR Simple JWT] Токен создан: ${token.substring(0, 50)}...`);

      return token;

    } catch (error) {
      console.error(`[TUSUR Simple JWT] Критическая ошибка: ${error.message}`);
      throw error;
    }
  }

  /**
   * Извлечь accessToken из WebSocket запроса
   */
  extractAccessTokenFromWebSocket(ctx) {
    // WebSocket клиенты Outline отправляют токен в query string
    // Пример: wss://outline-docs.tusur.ru/collaboration/document.xxx?accessToken=eyJ...
    const tokenFromQuery = ctx.query.accessToken || ctx.query.token;

    if (tokenFromQuery) {
      console.log(`[TUSUR WebSocket] Токен из query: ${tokenFromQuery.substring(0, 20)}...`);
      return tokenFromQuery;
    }

    // Также проверяем cookies (на всякий случай)
    const tokenFromCookies = ctx.cookies.get('accessToken');
    if (tokenFromCookies) {
      console.log(`[TUSUR WebSocket] Токен из cookies: ${tokenFromCookies.substring(0, 20)}...`);
      return tokenFromCookies;
    }

    return null;
  }

  /**
   * Валидация токена для WebSocket соединения
   */
  async validateWebSocketToken(accessToken) {
    try {
      console.log(`[TUSUR WebSocket Token] Валидация токена: ${accessToken.substring(0, 30)}...`);

      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(accessToken);

      if (!decoded || !decoded.id) {
        console.log(`[TUSUR WebSocket Token] Не могу декодировать токен или нет user.id`);
        return null;
      }

      console.log(`[TUSUR WebSocket Token] Декодирован: user=${decoded.id}, type=${decoded.type}`);

      // Находим пользователя
      const User = this.manager.models?.User;
      if (!User) {
        console.error(`[TUSUR WebSocket Token] Модель User не найдена`);
        return null;
      }

      const user = await User.findOne({
        where: { id: decoded.id }
      });

      if (!user) {
        console.log(`[TUSUR WebSocket Token] Пользователь ${decoded.id} не найден`);
        return null;
      }

      // Проверяем токен с user.jwtSecret
      if (user.jwtSecret) {
        try {
          jwt.verify(accessToken, user.jwtSecret, { algorithms: ['HS256'] });
          console.log(`[TUSUR WebSocket Token] Токен валиден (через user.jwtSecret)`);
          return user;
        } catch (error) {
          console.log(`[TUSUR WebSocket Token] Не валиден с user.jwtSecret: ${error.message}`);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error(`[TUSUR WebSocket Token] Ошибка валидации: ${error.message}`);
      return null;
    }
  }

  async getValidExistingToken(ctx, email) {
    try {
      const existingToken = ctx.cookies.get('accessToken');
      if (!existingToken) {
        return null;
      }

      console.log(`[TUSUR GetToken] Проверка существующего токена для email: ${email}`);

      const jwt = require('jsonwebtoken');

      // Сначала декодируем без проверки
      const decoded = jwt.decode(existingToken);
      if (!decoded || !decoded.id) {
        console.log(`[TUSUR GetToken] Не могу декодировать токен`);
        return null;
      }

      console.log(`[TUSUR GetToken] Декодированный токен:`, {
        id: decoded.id,
        type: decoded.type,
        expiresAt: decoded.expiresAt,
        exp: decoded.exp
      });

      // Ищем пользователя по ID из токена
      const User = this.manager.models?.User;
      if (!User) {
        console.error(`[TUSUR GetToken] Модель User не найдена`);
        return null;
      }

      const user = await User.findOne({
        where: { id: decoded.id, email: email }
      });

      if (!user) {
        console.log(`[TUSUR GetToken] Пользователь не найден: ID=${decoded.id}, email=${email}`);
        return null;
      }

      console.log(`[TUSUR GetToken] Найден пользователь: ${user.email}, jwtSecret: ${user.jwtSecret ? 'есть' : 'нет'}`);

      // Проверяем токен разными способами
      let isValid = false;

      // Способ 1: Проверка с jwtSecret пользователя
      if (user.jwtSecret) {
        try {
          jwt.verify(existingToken, user.jwtSecret, { algorithms: ['HS256'] });
          isValid = true;
          console.log(`[TUSUR GetToken] Токен валиден (через user.jwtSecret)`);
        } catch (error) {
          console.log(`[TUSUR GetToken] Не валиден с user.jwtSecret: ${error.message}`);
        }
      }

      // Способ 2: Проверка exp/expiresAt
      if (!isValid) {
        let tokenExpired = false;

        if (decoded.exp) {
          // exp в секундах
          const expiresAt = decoded.exp * 1000; // конвертируем в миллисекунды
          if (Date.now() >= expiresAt) {
            tokenExpired = true;
            console.log(`[TUSUR GetToken] Токен истек по exp: ${new Date(expiresAt).toISOString()}`);
          }
        } else if (decoded.expiresAt) {
          // expiresAt в ISO строке
          const expiresAt = new Date(decoded.expiresAt).getTime();
          if (Date.now() >= expiresAt) {
            tokenExpired = true;
            console.log(`[TUSUR GetToken] Токен истек по expiresAt: ${decoded.expiresAt}`);
          }
        }

        if (!tokenExpired) {
          console.log(`[TUSUR GetToken] Токен не истек, принимаем его`);
          isValid = true;
        }
      }

      if (isValid) {
        console.log(`[TUSUR GetToken] Возвращаем валидный токен для: ${user.email}`);
        return { user, token: existingToken };
      }

      console.log(`[TUSUR GetToken] Токен не валиден`);
      return null;

    } catch (error) {
      console.error(`[TUSUR GetToken] Ошибка проверки токена: ${error.message}`);
      return null;
    }
  }

  createCollaborationToken(user) {
    try {
      console.log(`[TUSUR Collaboration] Создание collaboration токена для: ${user.email}`);

      const jwt = require('jsonwebtoken');

      // Collaboration токен имеет другую структуру
      const payload = {
        id: user.id,
        type: "collaboration",  // ← Важно: тип "collaboration"!
        documentId: "global",   // Или конкретный documentId
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 часа
      };

      console.log(`[TUSUR Collaboration] Payload:`, payload);

      // Используем user.jwtSecret
      const secret = user.jwtSecret;
      if (!secret) {
        throw new Error('У пользователя нет jwtSecret');
      }

      const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
      console.log(`[TUSUR Collaboration] Токен создан: ${token.substring(0, 50)}...`);

      return token;

    } catch (error) {
      console.error(`[TUSUR Collaboration] Ошибка: ${error.message}`);

      // Fallback: используем accessToken
      return this.createOutlineAccessToken(user);
    }
  }

  async validateCollaborationToken(token) {
    try {
      console.log(`[TUSUR Collaboration] Валидация collaboration токена`);

      const jwt = require('jsonwebtoken');

      // Сначала декодируем без проверки
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.id) {
        console.log(`[TUSUR Collaboration] Не могу декодировать токен`);
        return null;
      }

      console.log(`[TUSUR Collaboration] Декодирован:`, {
        id: decoded.id,
        type: decoded.type,
        expiresAt: decoded.expiresAt
      });

      // Находим пользователя
      const User = this.manager.models?.User;
      if (!User) {
        console.error(`[TUSUR Collaboration] Модель User не найдена`);
        return null;
      }

      const user = await User.findOne({
        where: { id: decoded.id }
      });

      if (!user) {
        console.log(`[TUSUR Collaboration] Пользователь ${decoded.id} не найден`);
        return null;
      }

      // Проверяем токен
      let isValid = false;

      // Проверка collaboration токена
      if (decoded.type === 'collaboration' && user.jwtSecret) {
        try {
          jwt.verify(token, user.jwtSecret, { algorithms: ['HS256'] });
          isValid = true;
          console.log(`[TUSUR Collaboration] Collaboration токен валиден`);
        } catch (error) {
          console.log(`[TUSUR Collaboration] Не валиден как collaboration: ${error.message}`);
        }
      }

      // Если не collaboration токен, проверяем как session токен
      if (!isValid && user.jwtSecret) {
        try {
          jwt.verify(token, user.jwtSecret, { algorithms: ['HS256'] });
          isValid = true;
          console.log(`[TUSUR Collaboration] Session токен валиден для collaboration`);
        } catch (error) {
          console.log(`[TUSUR Collaboration] Не валиден как session: ${error.message}`);
        }
      }

      // Проверяем истечение срока
      if (isValid) {
        if (decoded.expiresAt) {
          const expiresAt = new Date(decoded.expiresAt).getTime();
          if (Date.now() >= expiresAt) {
            console.log(`[TUSUR Collaboration] Токен истек: ${decoded.expiresAt}`);
            isValid = false;
          }
        } else if (decoded.exp) {
          const expiresAt = decoded.exp * 1000;
          if (Date.now() >= expiresAt) {
            console.log(`[TUSUR Collaboration] Токен истек по exp: ${new Date(expiresAt).toISOString()}`);
            isValid = false;
          }
        }
      }

      if (isValid) {
        console.log(`[TUSUR Collaboration] Пользователь авторизован: ${user.email}`);
        return user;
      }

      return null;

    } catch (error) {
      console.error(`[TUSUR Collaboration] Ошибка валидации: ${error.message}`);
      return null;
    }
  }

  async handleRealtimeWebSocket(ctx, next) {
    console.log(`[TUSUR Realtime WebSocket] Обработка realtime: ${ctx.path}`);

    // Extract token from query (обычно передается как ?token=... или ?accessToken=...)
    const token = ctx.query.accessToken || ctx.query.token;

    if (!token) {
      console.log(`[TUSUR Realtime WebSocket] Нет токена в запросе`);
      // Пропускаем, Outline сам обработает
      return next();
    }

    // Validate the token
    const user = await this.validateWebSocketToken(token);
    if (user) {
      console.log(`[TUSUR Realtime WebSocket] Авторизован: ${user.email}`);
      ctx.state.user = user;
      ctx.state.authToken = token;
      return next();
    }

    console.log(`[TUSUR Realtime WebSocket] Токен невалиден`);
    return next();
  }

  async validateWebSocketToken(token) {
    try {
      console.log(`[TUSUR WebSocket Token] Валидация токена: ${token.substring(0, 30)}...`);

      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);

      if (!decoded || !decoded.id) {
        console.log(`[TUSUR WebSocket Token] Не могу декодировать токен или нет user.id`);
        return null;
      }

      console.log(`[TUSUR WebSocket Token] Декодирован: user=${decoded.id}, type=${decoded.type}`);

      // Находим пользователя
      const User = this.manager.models?.User;
      if (!User) {
        console.error(`[TUSUR WebSocket Token] Модель User не найдена`);
        return null;
      }

      const user = await User.findOne({
        where: { id: decoded.id }
      });

      if (!user) {
        console.log(`[TUSUR WebSocket Token] Пользователь ${decoded.id} не найден`);
        return null;
      }

      // Проверяем токен с user.jwtSecret
      if (user.jwtSecret) {
        try {
          jwt.verify(token, user.jwtSecret, { algorithms: ['HS256'] });
          console.log(`[TUSUR WebSocket Token] Токен валиден (через user.jwtSecret)`);
          return user;
        } catch (error) {
          console.log(`[TUSUR WebSocket Token] Не валиден с user.jwtSecret: ${error.message}`);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error(`[TUSUR WebSocket Token] Ошибка валидации: ${error.message}`);
      return null;
    }
  }

}

module.exports = WardenMiddleware;