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

      console.log('[TUSUR Auth Routes] Добавлено 2 маршрута');
    } catch (error) {
      console.error('[TUSUR Auth Routes] Ошибка добавления маршрутов:', error.message);
    }
  }
}

module.exports = AuthRoutes;
