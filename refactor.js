const fs = require('fs');
const path = 'c:/Users/GAME/Desktop/uno-km/dev/AMEVA-Workstation/packages/core/src/renderer/hooks/app/useAppFileOperations.ts';
let content = fs.readFileSync(path, 'utf8');

// Add getPlatformAdapter import if not there
if (!content.includes('getPlatformAdapter')) {
    content = content.replace(/import { useCallback, useEffect, useRef } from 'react'/g, "import { useCallback, useEffect, useRef } from 'react'\nimport { getPlatformAdapter } from '../../../shared/adapters/platformAdapter'");
}

// Replace handleOpenFile
content = content.replace(
    /if \(ipc\.isElectronEnv\(\)\) \{([\s\S]*?)const file = await ipc\.openFile\(\)/g,
    const adapter = getPlatformAdapter();
    if (ipc.isElectronEnv()) {
 file = await adapter.fs.openFileDialog()
);

fs.writeFileSync(path, content, 'utf8');