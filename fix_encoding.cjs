const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath);
        } else if (f.endsWith('.tsx')) {
            const buf = fs.readFileSync(dirPath);
            if (buf[0] === 0xFF && buf[1] === 0xFE) {
                const str = buf.toString('utf16le');
                fs.writeFileSync(dirPath, str, 'utf8');
                console.log('Converted', dirPath);
            }
        }
    });
}
walkDir('./src/renderer/components');
