const fs = require('fs');
const path = '/opt/outline/node_modules/engine.io/lib/server.js';

console.log('=== Проверка engine.io патчей ===');
if (fs.existsSync(path)) {
  const content = fs.readFileSync(path, 'utf8');
  
  // Ищем признаки патчей
  const hasTusur = content.includes('TUSUR');
  const hasUpgradeOverride = content.includes('applyMiddleware') && content.includes('TUSUR');
  
  console.log('Длина файла:', content.length);
  console.log('Содержит "TUSUR":', hasTusur);
  console.log('Содержит applyMiddleware override:', hasUpgradeOverride);
  
  // Ищем оригинальную функцию handleUpgrade
  const upgradeMatch = content.match(/handleUpgrade.*?\{[\s\S]*?\}/g);
  console.log('Найдено функций handleUpgrade:', upgradeMatch ? upgradeMatch.length : 0);
}