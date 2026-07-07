const fs = require('fs');
const appContent = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

const appStartIndex = appContent.indexOf('export function App()');
if (appStartIndex === -1) {
  console.log("Could not find App function");
  process.exit(1);
}

const appBody = appContent.substring(appStartIndex);
const stateRegex = /const \[([^,]+),\s*set([a-zA-Z0-9_]+)\]\s*=\s*useState/g;
const states = [];
let match;
while ((match = stateRegex.exec(appBody)) !== null) {
  states.push(match[1].trim());
}

const refRegex = /const ([a-zA-Z0-9_]+)\s*=\s*useRef/g;
const refs = [];
while ((match = refRegex.exec(appBody)) !== null) {
  refs.push(match[1].trim());
}

console.log("=== APP STATES ===");
console.log(states.join(', '));
console.log(`Total: ${states.length}`);

console.log("\n=== APP REFS ===");
console.log(refs.join(', '));
console.log(`Total: ${refs.length}`);

