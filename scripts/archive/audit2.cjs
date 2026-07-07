const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, 'src');
function getAllFiles(dir, fileList = []) {
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) getAllFiles(filePath, fileList);
    else if (/\.(tsx?|jsx?)$/.test(filePath)) fileList.push(filePath);
  }
  return fileList;
}

getAllFiles(srcDir).forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  let maxDepth = 0;
  let currentDepth = 0;
  let inFunc = 0;
  const lines = content.split('\n');
  for (let l of lines) {
    if (/\b(function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>)/.test(l)) {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    }
    if (l.includes('}')) {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }
  if (maxDepth >= 3 && f.includes('renderer')) {
    console.log(`${f.replace(__dirname + '\\', '')}: max function depth roughly ${maxDepth}`);
  }
});
