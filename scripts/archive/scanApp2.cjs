const fs = require('fs');

const appContent = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

// match all `useState`
const stateMatches = appContent.match(/useState\(/g);
console.log(`Total useState calls: ${stateMatches ? stateMatches.length : 0}`);

// match all `useRef`
const refMatches = appContent.match(/useRef\(/g);
console.log(`Total useRef calls: ${refMatches ? refMatches.length : 0}`);

// Look at the top of App()
const appFuncMatch = appContent.match(/export function App\(\) \{[\s\S]*?return \(/);
if (appFuncMatch) {
  const lines = appFuncMatch[0].split('\n').slice(0, 30);
  console.log('\nTop of App():');
  console.log(lines.join('\n'));
}

