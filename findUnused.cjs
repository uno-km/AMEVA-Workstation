const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    if (!file.includes('node_modules') && !file.includes('dist') && !file.includes('build')) {
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(file));
      } else {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(file);
        }
      }
    }
  });
  return results;
};

const allFiles = walk('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages');
const contents = allFiles.map(f => fs.readFileSync(f, 'utf8'));

let unusedFiles = [];
let duplicatedLogic = [];

allFiles.forEach((file) => {
  const basename = path.basename(file, path.extname(file));
  if (basename === 'index' || basename === 'main' || file.includes('App.tsx') || file.includes('test.ts')) return;

  // Check if this file is imported anywhere
  // E.g., import ... from './basename' or basename
  const isImported = contents.some(content => {
    return content.includes('/' + basename + "'") || 
           content.includes('/' + basename + '"') ||
           content.includes('./' + basename + "'") ||
           content.includes('./' + basename + '"');
  });

  if (!isImported) {
    unusedFiles.push(file.replace('c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/', ''));
  }
});

console.log("=== Potentially Unused Files ===");
unusedFiles.forEach(f => console.log(f));