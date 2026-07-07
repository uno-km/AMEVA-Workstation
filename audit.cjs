const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (/\.(tsx?|jsx?)$/.test(filePath)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const allFiles = getAllFiles(srcDir);

console.log("=== 1. File LOC Analysis ===");
const fileStats = allFiles.map(f => {
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n').length;
  return { file: f.replace(__dirname + '\\', ''), lines, content };
}).sort((a, b) => b.lines - a.lines);

fileStats.slice(0, 15).forEach(f => {
  console.log(`${f.file}: ${f.lines} lines`);
});

console.log("\n=== 2. any/unknown/Function Usage ===");
fileStats.forEach(f => {
  const matches = f.content.match(/\b(any|unknown|Function)\b/g);
  if (matches && matches.length > 5) {
    console.log(`${f.file}: ${matches.length} occurrences`);
  }
});

console.log("\n=== 3. window.electronAPI Usage ===");
fileStats.forEach(f => {
  if (f.content.includes('window.electronAPI')) {
    const lines = f.content.split('\n').filter(l => l.includes('window.electronAPI'));
    console.log(`${f.file}: ${lines.length} occurrences`);
  }
});

console.log("\n=== 4. Callback / Reference Patterns ===");
fileStats.forEach(f => {
  const lines = f.content.split('\n');
  let count = 0;
  lines.forEach((l, idx) => {
    if (/\bcurrent\s*=\s*\(\)|push\s*\(\s*\(\)|processNextQueueRef|MutableRefObject<.*=>|RefObject<.*=>|register[A-Z]\w*\(/.test(l)) {
      count++;
    }
  });
  if (count > 0) {
    console.log(`${f.file}: ${count} occurrences of dangerous callback/ref patterns`);
  }
});

console.log("\n=== 5. Hardcoded Constants ===");
fileStats.forEach(f => {
  const matches = f.content.match(/sk-ant|AIza|sk-|api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com/g);
  if (matches) {
    console.log(`${f.file}: Found hardcoded constant(s): ${[...new Set(matches)].join(', ')}`);
  }
});

console.log("\n=== 6. Zustand Store getState / excessive actions ===");
fileStats.forEach(f => {
  if (f.file.includes('store') || f.content.includes('create(')) {
    const actions = (f.content.match(/\bset\(/g) || []).length;
    const getStates = (f.content.match(/\.getState\(\)/g) || []).length;
    console.log(`${f.file}: set() calls: ${actions}, getState() calls: ${getStates}`);
  } else {
    const getStates = (f.content.match(/\.getState\(\)/g) || []).length;
    if (getStates > 0) console.log(`${f.file}: getState() calls: ${getStates}`);
  }
});

