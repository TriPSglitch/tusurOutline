class AuthRoutes {
  constructor(plugin) {
    this.plugin = plugin;
  }

  async activate(manager) {
    this.manager = manager;
    this.config = this.plugin.config;

    console.log('[TUSUR Auth Routes] Активация маршрутов');

    // Динамическая загрузка @koa/router
    let Router;
    try {
      // Пробуем разные способы загрузки
      const routerModule = require('/opt/outline/plugins/tusur-warden/node_modules/@koa/router');

      // @koa/router может экспортироваться по-разному
      if (routerModule && routerModule.defautl) {
        // ES6 default export
        Router = routerModule.default;
        console.log('[TUSUR Auth Routes] Router загружен как default export');
      } else if (routerModule && typeof routerModule === 'function') {
        // ComonJS export
        Router = routerModule;
        console.log('[TUSUR Auth Routes] Router загружен как function');
      } else if (routerModule && routerModule.Router) {
        // Named export
        Router = routerModule.Router;
        console.log('[TUSUR Auth Routes] Router загружен как named export');
      } else {
        console.error('[TUSUR Auth Routes] Неизвестный формат экспорта router');
        console.error('[TUSUR Auth Rouets] Модуль:', typeof routerModule, routerModule);
        return;
      }
    } catch (e) {
      console.error('[TUSUR Auth Routes] Не удалось загрузить Router:', e.message);
      console.error('[TUSUR Auth Routes] Стек ошибки:', e.stack);
      return;
    }

    // Проверяем, что Router - конструктор
    if (typeof Router !== 'function') {
      console.error('[TUSUR Auth Routes] Router не является функцией:', typeof Router);
      return;
    }

    try {
      // Создаем router
      this.router = new Router();
      console.log('[TUSUR Auth Routes] Router создан успешно');
    } catch (error) {
      console.error('[TUSUR Auth Routes] Ошибка создания Router:', error.message);
      return;
    }

    // Регистрируем в app
    if (manager.app) {
      try {
        manager.app.use(this.router.routes());
        manager.app.use(this.router.allowedMethods());
        console.log('[TUSUR Auth Routes] Router зарегистрирован в app');
      } catch (error) {
        console.error('[TUSUR Auth Routes] Ошибка регистрации router:', error.message);
        return;
      }
    }

    // Добавляем маршруты
    this.addRoutes();

    console.log('[TUSUR Auth Routes] Маршруты зарегистрированы');
    console.log(`[TUSUR Auth Routes Models] Manager (Object.keys(this.manager)): ${Object.keys(this.manager)}`);
    console.log(`[TUSUR Auth Routes Models] Models (this.manager.models): ${this.manager.models}`);
  }

  addRoutes() {
    if (!this.router) {
      console.error('[TUSUR Auth Routes] Router не инициализирован');
      return;
    }

    try {
      // Callback маршрут
      this.router.get('/auth/tusur/callback', (ctx) => {
        console.log('[TUSUR Callback] Обработка callback от warden');
        const returnTo = ctx.query.return_to || '/';
        console.log(`[TUSUR Callback] Возврат на" ${decodeURIComponent(returnTo)}`);
        ctx.redirect(decodeURIComponent(returnTo));
      });

      // Маршрут для ручного входа
      this.router.get('/auth/tusur', (ctx) => {
        const currentUrl = ctx.request.href;
        const returnTo = encodeURIComponent(currentUrl);
        const wardenUrl = `https://profile.tusur.ru/users/sign_in?redirect_url=${encodeURIComponent('https://outline-docs.tusur.ru/auth/tusur/callback?return_to=' + returnTo)}`;
        ctx.redirect(wardenUrl);
      });

      this.router.get('/auth/tusur/test', (ctx) => {
        const sessionId = ctx.cookies.get('_session_id');
        const accessToken = ctx.cookies.get('accessToken');
        const userId = ctx.cookies.get('userId');

        ctx.body = {
          sessionId,
          accessToken,
          userId,
          isAuthenticated: !!ctx.state.user,
          user: stx.state.user ? {
            id: ctx.state.user.id,
            email: ctx.state.user.email,
            name: ctx.state.user.name
          } : null
        };
      });

      this.router.get('/debug/session', (ctx) => {
        const cookies = ctx.cookies;
        const session = ctx.state;

        ctx.body = {
          cookiees: {
            connect_sid: cookies.get('connect.sid'),
            accessToken: cookies.get('accessToken'),
            userId: cookies.get('userId'),
            _session_id: cookies.get('_session_id')
          },
          state: {
            user: ctx.state.user ? {
              id: ctx.state.user.id,
              email: ctx.state.user.email,
              name: ctx.state.user.name
            } : null,
            authToken: ctx.state.authToken
          },
          headers: {
            authorization: ctx.get('Authorization'),
            'x-user-id': ctx.get('X-User-Id')
          }
        };
      });

      this.router.get('/auth/tusur/debug', (ctx) => {
        const allCookies = ctx.cookies;
        const headers = ctx.headers;

        ctx.body = {
          cookies: {
            session_id: allCookies.get('_session_id'),
            accessToken: allCookies.get('accessToken'),
            userId: allCookies.get('userId'),
            connect_sid: allCookies.get('connect.sid')
          },
          headers: {
            cookie: headers.cookie,
            authorization: headers.authorization
          },
          user: ctx.state.user ? {
            id: ctx.state.user.id,
            email: ctx.state.user.email
          } : null
        };
      });

      this.router.get('/auth/tusur/check-cookies', async (ctx) => {
        const cookies = {
          accessToken: ctx.cookies.get('accessToken'),
          connectSid: ctx.cookies.get('connect.sid'),
          sessionId: ctx.cookies.get('_session_id')
        };

        // Проверяем JWT если есть
        let decodedToken = null;
        if (cookies.accessToken) {
          try {
            const jwt = require('jsonwebtoken');
            const secret = process.env.UTILS_SECRET;
            decodedToken = jwt.verify(cookies.accessToken, secret);
          } catch (e) {
            decodedToken = { error: e.message };
          }
        }

        ctx.body = {
        cookies: cookies,
        decodedToken: decodedToken,
        ctxStateUser: ctx.state.user ? {
          id: ctx.state.user.id,
          email: ctx.state.user.email
          } : null,
          headers: {
            authorization: ctx.get('Authorization'),
            xUserId: ctx.get('X-User-Id'),
            xUserEmail: ctx.get('X-User-Email')
          }
        };
      });

      this.router.get('/auth/tusur/session-info', async (ctx) => {
          ctx.body = {
              sessionExists: !!ctx.session,
              session: ctx.session ? {
                  userId: ctx.session.userId,
                  userEmail: ctx.session.userEmail,
                  passport: ctx.session.passport,
                  cookie: ctx.session.cookie
              } : null,
              ctxState: {
                  user: ctx.state.user ? {
                      id: ctx.state.user.id,
                      email: ctx.state.user.email
                  } : null,
                  authToken: ctx.state.authToken
              },
              cookies: {
                  accessToken: ctx.cookies.get('accessToken'),
                  connectSid: ctx.cookies.get('connect.sid')
              }
          };
      });

      this.router.get('/auth/tusur/check-outline-auth', async (ctx) => {
        const User = this.manager.models?.User;
        const userId = ctx.state.user?.id;

        if (userId) {
          const user = await User.findOne({
            where: { id: userId },
            include: [{ model: this.manager.models?.Team, as: 'team' }]
          });

          ctx.body = {
            outlineAuth: {
              userInCtx: !!ctx.state.user,
              userId: ctx.state.user?.id,
              userInSession: ctx.session?.userId,
              passport: ctx.session?.passport,
              userFromDb: user ? {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
              } : null
            },
            cookies: {
              accessToken: ctx.cookies.get('accessToken'),
              connectSid: ctx.cookies.get('connect.sid')
            }
          };
        } else {
          ctx.body = { error: 'No user in ctx.state' };
        }
      });

      this.router.get('/auth/tusur/emulate-outline', async (ctx) => {
        const User = this.manager.models?.User;
        const user = await User.findOne({
          where: { email: 'kmacksim@yandex.ru' }
        });

        if (user) {
          // Полная эмуляция входа через Outline
          await this.integrateWithOutlineSession(ctx, user);

          ctx.body = {
            success: true,
            message: 'Сессия Outline эмулирована',
            user: {
              id: user.id,
              email: user.email
            }
          };
        } else {
          ctx.body = { success: false, message: 'Пользователь не найден' };
        }
      });

      this.router.get('/auth/tusur/verify-token', async (ctx) => {
        const accessToken = ctx.cookies.get('accessToken');
        if (!accessToken) {
          ctx.body = { error: 'No access token' };
          return;
        }

        try {
          const jwt = require('jsonwebtoken');

          // Попробуем декодировать без проверки
          const decoded = jwt.decode(accessToken);

          // Попробуем проверить разными способами
          const checks = {};

          // 1. Проверка с SECRET_KEY
          try {
            const secret = process.env.SECRET_KEY;
            jwt.verify(accessToken, secret);
            checks.withSecretKey = 'VALID';
          } catch (e) {
            checks.withSecretKey = `INVALID: ${e.message}`;
          }

          // 2. Проверка с UTILS_SECRET
          try {
            const utilsSecret = process.env.UTILS_SECRET;
            jwt.verify(accessToken, utilsSecret);
            checks.withUtilsSecret = 'VALID';
          } catch (e) {
            checks.withUtilsSecret = `INVALID: ${e.message}`;
          }

          ctx.body = {
            token: accessToken.substring(0, 50) + '...',
            decoded: decoded,
            checks: checks,
            structure: {
              hasId: !!decoded?.id,
              hasType: !!decoded?.type,
              type: decoded?.type,
              hasExpiresAt: !!decoded?.expiresAt,
              expiresAt: decoded?.expiresAt,
              hasTokenId: !!decoded?.tokenId,
              tokenId: decoded?.tokenId
            }
          };

        } catch (error) {
          ctx.body = { error: error.message };
        }
      });
/*
      this.router.get('/auth/tusur/logout', async (ctx) => {
        console.log('[TUSUR Logout] Начало процедуры выхода');

        try {
          // 1. Получаем session_id из куки warden
          const sessionId = ctx.cookies.get('_session_id');
          const accessToken = ctx.cookies.get('accessToken');
          const connectSid = ctx.cookies.get('connect.sid');

          console.log('[TUSUR Logout] Session ID:', sessionId ? 'присутствует' : 'отсутствует');
          console.log('[TUSUR Logout] Access Token:', accessToken ? 'присутствует' : 'отсутствует');
          console.log('[TUSUR Logout] Connect SID:', connectSid ? 'присутствует' : 'отсутствует');

          // 2. Отправляем запрос на выход в warden (если есть session_id)
          if (sessionId) {
            try {
              console.log('[TUSUR Logout] Отправляем запрос на выход в warden');
              // Для DELETE запроса нужен fetch с настройками
              const fetch = require('node-fetch');

              const response = await fetch('https://profile.tusur.ru/users/sign_out', {
                method: 'GET', // Некоторые системы используют GET для выхода
                headers: {
                  'Cookie': `_session_id=${sessionId}`
                },
                redirect: 'manual' // Не следовать редиректам
              });

              console.log('[TUSUR Logout] Ответ от warden:', response.status);
            } catch (wardenError) {
              console.error('[TUSUR Logout] Ошибка при выходе из warden:', wardenError.message);
            }
          }

          // 3. Очищаем все куки Outline
          const cookieOptions = {
            path: '/',
            domain: '.outline-docs.tusur.ru',
            httpOnly: false
          };

          // Очищаем accessToken
          ctx.cookies.set('accessToken', null, {
            ...cookieOptions,
            expires: new Date(0)
          });

          // Очищаем connect.sid (сессия Outline)
          ctx.cookies.set('connect.sid', null, {
            ...cookieOptions,
            httpOnly: true,
            expires: new Date(0)
          });

          // Очищаем куки warden
          ctx.cookies.set('_session_id', null, {
            ...cookieOptions,
            expires: new Date(0)
          });

          // Очищаем другие возможные куки
          ctx.cookies.set('userId', null, {
            ...cookieOptions,
            expires: new Date(0)
          });

          // 4. Очищаем сессию (если есть)
          if (ctx.session) {
            ctx.session = null;
          }

          // 5. Редирект на warden для полноценного выхода или на главную
          const returnTo = ctx.query.return_to || 'https://outline-docs.tusur.ru';

          console.log('[TUSUR Logout] Выход завершен, редирект на:', returnTo);
        } catch (error) {
          console.error('[TUSUR Logout] Критическая ошибка:', error);
          ctx.redirect('/');
        }
      });
*/
      console.log('[TUSUR Auth Routes] Добавлено 9 маршрутов');
    } catch (error) {
      console.error('[TUSUR Auth Routes] Ошибка добавления маршрутов:', error.message);
    }
  }
}

module.exports = AuthRoutes;
