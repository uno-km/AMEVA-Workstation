const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'src/renderer/App.tsx');
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace('export default const welcomeMD', 'const welcomeMD');
fs.writeFileSync(appPath, app);
