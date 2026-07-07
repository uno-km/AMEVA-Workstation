const fs = require('fs');

const orig = fs.readFileSync('AIPanel_original.tsx', 'utf-8');

// We want to list all functions and state variables inside AIPanel function.
const startIdx = orig.indexOf('export function AIPanel({');
const endIdx = orig.indexOf('return (', startIdx);
const logicBlock = orig.substring(startIdx, endIdx);

console.log(logicBlock);
