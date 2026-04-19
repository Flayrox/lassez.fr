const fs = require('fs');
const path = require('path');
function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/'\.\.\/(components|lib|types|utils|payload|hooks|context)/g, "'@/$1");
      content = content.replace(/"\.\.\/(components|lib|types|utils|payload|hooks|context)/g, '"@/$1');
      content = content.replace(/'\.\.\/\.\.\/(components|lib|types|utils|payload|hooks|context)/g, "'@/$1");
      content = content.replace(/"\.\.\/\.\.\/(components|lib|types|utils|payload|hooks|context)/g, '"@/$1');
      content = content.replace(/'\.\.\/\.\.\/\.\.\/(components|lib|types|utils|payload|hooks|context)/g, "'@/$1");
      content = content.replace(/"\.\.\/\.\.\/\.\.\/(components|lib|types|utils|payload|hooks|context)/g, '"@/$1');
      
      // Also fix '..' imports for the ones that are at the root
      content = content.replace(/'\.\.\/(globals\.css)/g, "'@/app/$1");
      content = content.replace(/"\.\.\/(globals\.css)/g, '"@/app/$1');

      if (original !== content) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed ' + fullPath);
      }
    }
  }
}
replaceInDir('app/(frontend)');
