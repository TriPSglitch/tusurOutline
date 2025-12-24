const fs = require('fs');
const path = require('path');

console.log('=== ИСПРАВЛЕНИЕ ИМПОРТОВ В server/index.js ===\n');

const indexPath = '/opt/outline/build/server/index.js';

if (!fs.existsSync(indexPath)) {
    console.log('❌ Файл не существует!');
    process.exit(1);
}

console.log('Читаю файл...');
let content = fs.readFileSync(indexPath, 'utf8');
const lines = content.split('\n');

console.log('Ищу проблемные импорты...');

// Ищем строку с require('./ApiKey') - должно быть require('./models/ApiKey')
let fixed = false;

const newLines = lines.map((line, index) => {
    // Проверяем номер строки (вы сказали строка 216)
    if (index === 215) { // индексы с 0
        console.log(`Строка ${index + 1}: ${line}`);
        
        // Исправляем неправильные импорты
        if (line.includes("require('./ApiKey')") || line.includes('require("./ApiKey")')) {
            console.log('⚠ Найден неправильный импорт ApiKey');
            console.log('Исправляю на require(\'./models/ApiKey\')...');
            
            fixed = true;
            return line.replace(/require\('\.\/ApiKey'\)/g, "require('./models/ApiKey')")
                       .replace(/require\("\.\/ApiKey"\)/g, 'require("./models/ApiKey")');
        }
    }
    
    // Также проверяем другие возможные неправильные импорты
    const modelImports = ['Attachment', 'Collection', 'Document', 'Team', 'User'];
    modelImports.forEach(model => {
        if (line.includes(`require('./${model}')`) || line.includes(`require("./${model}")`)) {
            console.log(`⚠ Найден неправильный импорт ${model}`);
            console.log(`Исправляю на require('./models/${model}')...`);
            
            fixed = true;
            return line.replace(new RegExp(`require\\('\\./${model}'\\)`, 'g'), `require('./models/${model}')`)
                       .replace(new RegExp(`require\\("\\./${model}"\\)`, 'g'), `require("./models/${model}")`);
        }
    });
    
    return line;
});

if (fixed) {
    // Создаем backup
    const backupPath = indexPath + '.before-fix';
    fs.writeFileSync(backupPath, content);
    console.log(`✓ Создан backup: ${backupPath}`);
    
    // Сохраняем исправленный файл
    fs.writeFileSync(indexPath, newLines.join('\n'));
    console.log('✅ Импорты исправлены!');
    
    // Показываем исправленные строки
    console.log('\nИсправленные строки:');
    newLines.forEach((line, index) => {
        if (line !== lines[index]) {
            console.log(`${index + 1}: ${line}`);
        }
    });
} else {
    console.log('✓ Неправильных импортов не найдено');
    
    // Все равно проверяем все require
    console.log('\nВсе require в файле:');
    lines.forEach((line, index) => {
        if (line.includes('require(')) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    });
}

// Проверяем, есть ли models/ApiKey.js
console.log('\nПроверка наличия models/ApiKey.js...');
const apiKeyPath = '/opt/outline/build/server/models/ApiKey.js';

if (fs.existsSync(apiKeyPath)) {
    console.log('✓ models/ApiKey.js существует');
} else {
    console.log('❌ models/ApiKey.js не существует!');
    console.log('Создаю заглушку...');
    
    const apiKeyStub = `"use strict";
module.exports = (sequelize, DataTypes) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    secret: DataTypes.STRING
  });
  
  return ApiKey;
};`;
    
    // Создаем директорию если нужно
    const modelsDir = path.dirname(apiKeyPath);
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    fs.writeFileSync(apiKeyPath, apiKeyStub);
    console.log('✓ Создана заглушка models/ApiKey.js');
}