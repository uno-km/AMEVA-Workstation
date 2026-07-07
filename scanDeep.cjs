const fs = require('fs');
const orig = fs.readFileSync('AIPanel_original.tsx', 'utf-8');

// Find all useEffect blocks
const effects = [];
let match;
const regex = /useEffect\([^]*?}\s*,\s*\[.*?\]\)/g;
while ((match = regex.exec(orig)) !== null) {
  effects.push(match[0]);
}
console.log('--- ALL EFFECTS ---');
effects.forEach((eff, i) => console.log(`Effect ${i}: \n${eff}\n`));

// Find all const handle... =
const handlers = [];
const hRegex = /const (handle\w+)\s*=\s*\(/g;
while ((match = hRegex.exec(orig)) !== null) {
  handlers.push(match[1]);
}
console.log('--- ALL HANDLERS ---');
console.log(handlers.join(', '));

// Find all const get... =
const getters = [];
const gRegex = /const (get\w+)\s*=\s*\(/g;
while ((match = gRegex.exec(orig)) !== null) {
  getters.push(match[1]);
}
console.log('--- ALL GETTERS ---');
console.log(getters.join(', '));
