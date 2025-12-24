const fs = require('fs');
const path = require('path');

const filePath = '/opt/outline/build/server/routes/api/auth/auth.js';

try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Исправляем ошибку в методе info (строка ~91)
    // Ищем проблемный участок кода и корректируем синтаксис
    const brokenPattern = /(router\.get\("info"[^}]+}[\s\S]*?){/;
    const workingReplacement = `router.get("info", authenticate(), async (req, res) => {
  const user = req.user;
  const team = await user.$get("team");
  
  // ... rest of the code
  res.json({
    data: await presentUser(user, {
      includeDetails: true,
    }),
  });
`;

    if (brokenPattern.test(content)) {
        console.log('Найдена и исправлена синтаксическая ошибка в методе info');
        content = content.replace(brokenPattern, workingReplacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Файл успешно обновлен.');
    } else {
        console.log('Проблемный шаблон не найден. Проверьте структуру файла.');
        console.log('Просмотр строк 85-100 файла:');
        const lines = content.split('\n');
        lines.slice(84, 100).forEach((line, i) => console.log(`${i + 85}: ${line}`));
    }

} catch (error) {
    console.error('Ошибка при применении патча:', error.message);
    process.exit(1);
}