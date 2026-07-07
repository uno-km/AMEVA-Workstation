const fs = require('fs');

let content = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');

// Ensure ipc is imported
if (!content.includes("import { ipc }")) {
    content = content.replace(
        "import React", 
        "import { ipc } from '../services/ipc/electronApiAdapter'\nimport React"
    );
}

// Replace window.electronAPI usages with ipc
content = content.replace(/if \(!window\.electronAPI \|\|/g, "if (!ipc ||");
content = content.replace(/await window\.electronAPI\.keychainGet/g, "await ipc.keychainGet");
content = content.replace(/if \(window\.electronAPI\) \{/g, "if (ipc) {");
content = content.replace(/window\.electronAPI\.keychainDelete/g, "ipc.keychainDelete");
content = content.replace(/window\.electronAPI\.keychainSet/g, "ipc.keychainSet");
content = content.replace(/window\.electronAPI\?\.llmGetGpuName/g, "ipc.llmGetGpuName");
content = content.replace(/window\.electronAPI\.llmGetGpuName/g, "ipc.llmGetGpuName");
content = content.replace(/window\.electronAPI\?\.llmDownloadModel/g, "ipc.llmDownloadModel");
content = content.replace(/window\.electronAPI\.llmDownloadModel\(model\.filename,\s*\{\s*url:\s*model\.url\s*\}\)/g, "ipc.llmDownloadModel({ url: model.url, filename: model.filename })");
content = content.replace(/window\.electronAPI\?\.openExternalLink/g, "ipc.openExternalLink");
content = content.replace(/window\.electronAPI\.openExternalLink/g, "ipc.openExternalLink");

fs.writeFileSync('src/renderer/components/AIPanel.tsx', content, 'utf-8');
console.log("Replaced window.electronAPI with ipc in AIPanel.tsx");
