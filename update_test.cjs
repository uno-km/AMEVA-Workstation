const fs = require('fs');
let content = fs.readFileSync('test_diff3.cjs', 'utf8');
content = content.replace("'line 1\\nline 2\\nline 3\\nline 4\\nline 5'", "'line1\\nline2\\nline3\\nline4\\nline5'");
fs.writeFileSync('test_diff3.cjs', content);
