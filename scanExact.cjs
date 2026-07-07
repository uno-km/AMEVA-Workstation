const fs = require('fs');

const orig = fs.readFileSync('AIPanel_original.tsx', 'utf-8');

const matchBlocks = (pattern) => {
    let match = pattern.exec(orig);
    return match ? match[0] : 'NOT FOUND';
}

console.log("getContextWithRAG:");
console.log(matchBlocks(/const getContextWithRAG\s*=\s*\([^]*?return [^}]*\n\s*}/));

console.log("\ngetActiveMode:");
console.log(matchBlocks(/const getActiveMode\s*=\s*\([^]*?return [^}]*\n\s*}/));

console.log("\nhandleSend:");
console.log(matchBlocks(/const handleSend\s*=\s*\(\)\s*=>\s*{[^]*?setInput\(''\)\n\s*}/));

console.log("\nhandleDownloadModel (onClick):");
console.log(matchBlocks(/onClick={async \(\) => {\s*if \(ipc\.llmDownloadModel[^]*?setDownloadStatus\(null\)\n\s*}\s*}\s*}}/));

console.log("\nhandleSaveKey / handleDeleteKey:");
console.log(matchBlocks(/const handleSaveKey\s*=\s*async[^]*?}\n\s*const handleDeleteKey\s*=\s*async[^]*?}/));

