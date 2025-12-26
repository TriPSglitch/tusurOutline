const fs = require('fs');
const path = require('path');

console.log('=== ВОССТАНОВЛЕНИЕ ОРИГИНАЛЬНЫХ ФАЙЛОВ ИЗ BACKUP ===\n');
console.log('Восстанавливаю ТОЛЬКО из существующих backup файлов, без изменений\n');

// 1. Восстановление server/index.js
console.log('1. Восстановление server/index.js...');
const indexPath = '/opt/outline/build/server/index.js';
const indexBackups = [
    indexPath + '.original',
    indexPath + '.backup',
    '/opt/outline/build/server/index.js.backup'
];

let indexRestored = false;
for (const backup of indexBackups) {
    if (fs.existsSync(backup)) {
        console.log(`   Найден backup: ${backup}`);
        fs.copyFileSync(backup, indexPath);
        console.log(`   ✓ Восстановлен из: ${path.basename(backup)}`);
        indexRestored = true;
        break;
    }
}

if (!indexRestored) {
    console.log('   ⚠ Backup не найден! Ищу исходный файл...');
    // Ищем в других местах
    const possiblePaths = [
        '/opt/outline/server/index.js',
        '/opt/outline/index.js',
        '/opt/outline/build/index.js'
    ];

    for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
            fs.copyFileSync(possiblePath, indexPath);
            console.log(`   ✓ Скопирован из: ${possiblePath}`);
            indexRestored = true;
            break;
        }
    }
}

if (!indexRestored) {
    console.log('   ❌ Не удалось восстановить index.js');
}

// 2. Восстановление env.js
console.log('\n2. Восстановление env.js...');
const envPath = '/opt/outline/build/server/env.js';
const envBackups = [
    envPath + '.original',
    envPath + '.backup',
    '/opt/outline/build/server/env.js.backup',
    '/opt/outline/build/server/env.js.original'
];

let envRestored = false;
for (const backup of envBackups) {
    if (fs.existsSync(backup)) {
        console.log(`   Найден backup: ${backup}`);
        fs.copyFileSync(backup, envPath);
        console.log(`   ✓ Восстановлен из: ${path.basename(backup)}`);
        envRestored = true;
        break;
    }
}

if (!envRestored) {
    console.log('   ⚠ Backup не найден, проверяем текущий файл...');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('TUSUR_PATCH_APPLIED')) {
            console.log('   ⚠ Файл содержит TUSUR патчи, но backup отсутствует');
        } else {
            console.log('   ✓ Файл выглядит оригинальным');
        }
    }
}

// 3. Восстановление models
console.log('\n3. Проверка models...');
const modelsPath = '/opt/outline/build/server/models';
if (fs.existsSync(modelsPath)) {
    // Ищем backup директории
    const modelsBackup = modelsPath + '.backup';
    if (fs.existsSync(modelsBackup)) {
        console.log('   Найден backup директории models, восстанавливаю...');
        // Копируем все файлы из backup
        const copyDir = (src, dest) => {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            const items = fs.readdirSync(src);
            items.forEach(item => {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    copyDir(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
            });
        };
        copyDir(modelsBackup, modelsPath);
        console.log('   ✓ Директория models восстановлена из backup');
    } else {
        console.log('   Проверяем файлы в models...');
        const modelFiles = fs.readdirSync(modelsPath).filter(f => f.endsWith('.js'));
        console.log(`   Найдено ${modelFiles.length} файлов моделей`);

        // Проверяем наличие критических моделей
        const criticalModels = ['ApiKey.js', 'index.js'];
        criticalModels.forEach(model => {
            const modelPath = path.join(modelsPath, model);
            if (fs.existsSync(modelPath)) {
                console.log(`   ✓ ${model} присутствует`);
            } else {
                console.log(`   ❌ ${model} отсутствует`);
            }
        });
    }
} else {
    console.log('   ❌ Директория models не существует!');
}

// 4. Восстановление routes
console.log('\n4. Проверка routes...');
const routesPath = '/opt/outline/build/server/routes';
if (fs.existsSync(routesPath)) {
    // Восстановление routes/index.js
    const routesIndexPath = path.join(routesPath, 'index.js');
    const routesIndexBackup = routesIndexPath + '.backup';

    if (fs.existsSync(routesIndexBackup)) {
        fs.copyFileSync(routesIndexBackup, routesIndexPath);
        console.log('   ✓ routes/index.js восстановлен из backup');
    } else if (fs.existsSync(routesIndexPath)) {
        console.log('   routes/index.js существует');
    } else {
        console.log('   ⚠ routes/index.js отсутствует');
    }

    // Восстановление auth.js если есть backup
    const authPath = path.join(routesPath, 'api/auth/auth.js');
    const authBackup = authPath + '.backup';
    if (fs.existsSync(authBackup)) {
        fs.copyFileSync(authBackup, authPath);
        console.log('   ✓ auth.js восстановлен из backup');
    }
} else {
    console.log('   ❌ Директория routes не существует!');
}

// 5. Восстановление node_modules патчей
console.log('\n5. Отмена патчей в node_modules...');
const nodeModulesPatches = [
    '/opt/outline/node_modules/engine.io/build/server.js',
    '/opt/outline/node_modules/engine.io/lib/transports/websocket.js',
    '/opt/outline/node_modules/socket.io/dist/index.js'
];

nodeModulesPatches.forEach(modulePath => {
    const backup = modulePath + '.backup';
    if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, modulePath);
        console.log(`   ✓ ${path.basename(modulePath)} восстановлен из backup`);
    }
});

// 6. Проверка структуры
console.log('\n6. Проверка структуры сервера...');
const serverFiles = [
    'index.js',
    'env.js',
    'routes/index.js',
    'models/index.js',
    'services/index.js'
];

serverFiles.forEach(file => {
    const fullPath = path.join('/opt/outline/build/server', file);
    const exists = fs.existsSync(fullPath);
    console.log(`   ${file}: ${exists ? '✓' : '❌'}`);
});

// 7. Проверяем, есть ли index.js и он запускается
console.log('\n7. Проверка server/index.js...');
if (fs.existsSync(indexPath)) {
    try {
        const content = fs.readFileSync(indexPath, 'utf8');

        // Проверяем базовые вещи
        const checks = [
            { name: 'Начинается с "use strict"', check: content.startsWith('"use strict"') || content.includes("'use strict'") },
            { name: 'Импортирует Koa', check: content.includes('require("koa")') || content.includes("require('koa')") },
            { name: 'Импортирует http', check: content.includes('require("http")') || content.includes("require('http')") },
            { name: 'Есть функция start', check: content.includes('function start') || content.includes('async function start') },
            { name: 'Есть module.exports', check: content.includes('module.exports') }
        ];

        checks.forEach(check => {
            console.log(`   ${check.name}: ${check.check ? '✓' : '✗'}`);
        });

        // Проверяем на наличие TypeScript синтаксиса
        if (content.includes(':') && content.includes('async function')) {
            console.log('   ⚠ ВНИМАНИЕ: Возможен TypeScript синтаксис в файле!');
            console.log('   Это может вызвать ошибку "Unexpected token \':\'"');
        }

    } catch (error) {
        console.log(`   ❌ Ошибка чтения файла: ${error.message}`);
    }
}

console.log('\n=== ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО ===');
console.log('\nЧто сделано:');
console.log('1. Восстановлены файлы из существующих backup');
console.log('2. Отменены патчи в node_modules');
console.log('3. Проверена структура сервера');
console.log('\nСледующие шаги:');
console.log('1. Перезапустите контейнер: docker-compose restart outline');
console.log('2. Если есть ошибки, проверьте логи: docker-compose logs outline');
console.log('3. Если index.js содержит TypeScript, может потребоваться его конвертация в JS');