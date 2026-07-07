const fs = require('fs');

const appContent = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

const stateRegex = /const \[([a-zA-Z0-9_]+),\s*set[a-zA-Z0-9_]+\]\s*=\s*useState/g;
let match;
const states = [];
while ((match = stateRegex.exec(appContent)) !== null) {
  states.push(match[1]);
}

const refRegex = /const ([a-zA-Z0-9_]+Ref)\s*=\s*useRef/g;
const refs = [];
while ((match = refRegex.exec(appContent)) !== null) {
  refs.push(match[1]);
}

const syncRegex = /useEffect\(\(\) => \{\n\s*[a-zA-Z0-9_]+Ref\.current\s*=\s*[a-zA-Z0-9_]+[\s\S]*?\}, \[.*?\]\)/g;
const syncs = [];
while ((match = syncRegex.exec(appContent)) !== null) {
  syncs.push(match[0].split('\n')[1].trim());
}

console.log("=== STATES ===");
console.log(states.join(', '));
console.log(`\nTotal States: ${states.length}`);

console.log("\n=== REFS ===");
console.log(refs.join(', '));
console.log(`\nTotal Refs: ${refs.length}`);

console.log("\n=== SYNC ANTI-PATTERNS (useEffect) ===");
console.log(syncs.join('\n'));

