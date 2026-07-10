const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src/renderer/App.tsx');
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace('function App() {', 'export default function App() {');
fs.writeFileSync(appPath, app);
