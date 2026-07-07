const fs = require('fs');

const orig = fs.readFileSync('AIPanel_original.tsx', 'utf-8');

const matchBlocks = (pattern) => {
    let match;
    const results = [];
    while ((match = pattern.exec(orig)) !== null) {
        results.push(match[0].substring(0, 100) + '...');
    }
    return results;
}

console.log("EFFECTS:");
console.log(matchBlocks(/useEffect\([^]*?}\s*,\s*\[.*?\]\)/g).join('\n'));

console.log("FUNCTIONS:");
console.log(matchBlocks(/const handle[A-Z]\w+\s*=\s*\([^]*?=>/g).join('\n'));
console.log(matchBlocks(/const get[A-Z]\w+\s*=\s*\([^]*?=>/g).join('\n'));
