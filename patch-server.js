// patch-server.js
const fs = require('fs');
const path = require('path');

const serverFile = '/opt/outline/build/server/index.js';
console.log('Patching Outline server file:', serverFile);

let code = fs.readFileSync(serverFile, 'utf8');

// Проверяем, не патчили ли уже
if (code.includes('TUSUR_PATCH_APPLIED')) {
    console.log('Server already patched');
    process.exit(0);
}

// Патч для загрузки плагина
const patch = `
// ======= TUSUR WARDEN PATCH ========
console.log('TUSUR_PATCH_APPLIED: Loading TUSUR warden plugin');

// Функция для получения моделей Outline
const getOutlineModels = () => {
    console.log('[TUSUR] Loading Outline models from /opt/outline/build/server/models/index.js');

    try {
        // Основной путь к моделям
        const modelsPath = '/opt/outline/build/server/models/index.js';
        const models = require(modelsPath);

        console.log('[TUSUR] Models loaded successfully');
        console.log('[TUSUR] Available models:', Object.keys(models).filter(key => !key.startsWith('_')).join(', '));

        return models;
    } catch (error) {
        console.error('[TUSUR] Error loading models:', error.message);

        // Альтернативный способ: через sequelize
        try {
            if (global.sequelize && global.sequelize.models) {
                console.log('[TUSUR] Using models from global.sequelize');
                return global.sequelize.models;
            }
        } catch (e) {
            console.error('[TUSUR] global.sequelize also not available:', e.message);
        }

        return null;
    }
};

// Функция для отложенной инициализации плагина
try {
    const TusurWardenPlugin = require('/opt/outline/plugins/tusur-warden/index.js');
    console.log('TUSUR plugin module loaded successfully');
    // Получаем модели
    tusurModels = getOutlineModels();

    if (!tusurModels) {
        console.error('[TUSUR] CRITICAL: Could not load Outline models');
        console.error('[TUSUR] Will continue without models');
    }

    // Создаем менеджер с моделями (если нашли)
    const manager = {
        app: app,
        models: tusurModels,
        logger: console,
        getModelNames: () => tusurModels ? Object.keys(tusurModels).filter(k => !k.startsWith('_')) : []
    };
    // Создаем и активируем плагин
    const pluginInstance = new TusurWardenPlugin();
    pluginInstance.activate(manager).then(() => {
        console.log('TUSUR plugin activated successfully');
    }).catch(err => {
        console.error('Failed to activate TUSUR plugin:', err);
    });

} catch (error) {
    console.error('[TUSUR] Failed to initialize plugin:', error);
    console.error(error.stack);
}
// ======= END TUSUR PATCH ========
`;

// Вставляем патч
let insertionPoint = null;
let lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    if ((lines[i].includes('module.exports =') || lines[i].includes('export default')) && !insertionPoint) {
        insertionPoint = i;
        break;
    }
}

if (insertionPoint !== null) {
    console.log(`Found export at line ${insertionPoint + 1}`);
    lines.splice(insertionPoint, 0, patch);
} else {
    // Ищем где app используется
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('app.listen') || lines[i].includes('app.use(') || lines[i].includes('const server =')) {
            insertionPoint = i;
            console.log(`Found app usage at line ${insertionPoint + 1}`);
            lines.splice(insertionPoint, 0, patch);
            break;
        }
    }

    if (insertionPoint === null) {
        console.log('Adding to end of file');
        lines.push(patch);
    }
}

fs.writeFileSync(serverFile, lines.join('\n'));
console.log('Server patched successfully');
