const fs = require('fs');
const path = require('path');

console.log('=== Исправление TypeScript в server/index.js ===\n');

const indexPath = '/opt/outline/build/server/index.js';

if (!fs.existsSync(indexPath)) {
    console.log('❌ Файл index.js не существует!');
    process.exit(1);
}

console.log('Читаю файл...');
let content = fs.readFileSync(indexPath, 'utf8');

console.log('Длина файла:', content.length, 'символов');

// Проверяем на наличие TypeScript синтаксиса
const hasTypeScript = content.match(/:\s*(number|string|boolean|void|any|Promise)/);
if (!hasTypeScript) {
    console.log('✓ Файл не содержит TypeScript синтаксиса');
    process.exit(0);
}

console.log('⚠ Обнаружен TypeScript синтаксис, преобразую в JavaScript...');

// Создаем backup
const backupPath = indexPath + '.before-ts-fix';
fs.writeFileSync(backupPath, content);
console.log('✓ Создан backup:', backupPath);

// Простые замены TypeScript -> JavaScript
let jsContent = content;

// 1. Удаляем аннотации типов параметров функций
jsContent = jsContent.replace(/(async\s+)?function\s+\w+\(([^)]+)\)/g, (match, async, params) => {
    // Удаляем : type из параметров
    const cleanParams = params.replace(/:\s*\w+/g, '');
    return (async || '') + 'function(' + cleanParams + ')';
});

// 2. Удаляем аннотации типов переменных (const x: type =)
jsContent = jsContent.replace(/(const|let|var)\s+(\w+)\s*:\s*\w+/g, '$1 $2');

// 3. Удаляем TypeScript импорты/экспорты типов
jsContent = jsContent.replace(/import\s+type\s+[^;]+;/g, '');
jsContent = jsContent.replace(/export\s+type\s+[^;]+;/g, '');

// 4. Удаляем интерфейсы
jsContent = jsContent.replace(/interface\s+\w+\s*{[^}]*}/g, '');

// 5. Удаляем declare
jsContent = jsContent.replace(/declare\s+/g, '');

// 6. Простые замены common TypeScript patterns
jsContent = jsContent.replace(/:\s*void/g, '');
jsContent = jsContent.replace(/:\s*any/g, '');
jsContent = jsContent.replace(/:\s*Promise/g, '');
jsContent = jsContent.replace(/:\s*number/g, '');
jsContent = jsContent.replace(/:\s*string/g, '');
jsContent = jsContent.replace(/:\s*boolean/g, '');

// 7. Удаляем пустые строки
jsContent = jsContent.replace(/\n\s*\n\s*\n/g, '\n\n');

console.log('Записываю исправленный файл...');
fs.writeFileSync(indexPath, jsContent);

console.log('\n✅ Преобразование завершено!');
console.log('Длина после преобразования:', jsContent.length, 'символов');

// Проверяем результат
const newContent = fs.readFileSync(indexPath, 'utf8');
const stillHasTS = newContent.match(/:\s*(number|string|boolean|void|any|Promise)/);

if (stillHasTS) {
    console.log('⚠ В файле еще остался TypeScript синтаксис');
} else {
    console.log('✓ Файл теперь чистый JavaScript');
}