const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

content = content.replace(/,\s*Copy/g, "");
content = content.replace(/Copy\s*,/g, "");

content = content.replace(/engineLogs,\s*setEngineLogs/, "engineLogs");

fs.writeFileSync('src/renderer/components/AIPanel.tsx', content, 'utf-8');
console.log("Replaced Copy and setEngineLogs");
