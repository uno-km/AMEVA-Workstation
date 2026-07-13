const fs = require('fs');
const path = require('path');

// Default paths related to Deep Reasoning and AI Agent
const DEFAULT_PATHS = [
  'packages/core/src/renderer/services/ai',
  'packages/core/src/renderer/hooks/ai',
  'packages/core/src/renderer/hooks/useReasoningProvider.ts',
  'packages/core/src/renderer/hooks/useAIAgent.ts',
  'packages/core/src/shared/reasoningTypes.ts',
  'packages/core/src/renderer/components/ai',
  'packages/core/src/renderer/components/ai-panel'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', 'dist', '.git'].some(exclude => fullPath.includes(exclude))) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (/\.(ts|tsx|js|jsx|py|json|c|h|md)$/.test(file)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function main() {
  const workspaceDir = path.resolve(__dirname, '..');
  const outputDir = path.join(workspaceDir, 'source-doc');

  // Create source-doc directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : DEFAULT_PATHS;

  let filesToExtract = [];

  targets.forEach(target => {
    const fullTargetPath = path.join(workspaceDir, target);
    if (!fs.existsSync(fullTargetPath)) {
      console.warn(`Warning: Path not found: {fullTargetPath}`);
      return;
    }

    if (fs.statSync(fullTargetPath).isFile()) {
      filesToExtract.push(fullTargetPath);
    } else {
      filesToExtract = getAllFiles(fullTargetPath, filesToExtract);
    }
  });

  // Unique and sort
  filesToExtract = [...new Set(filesToExtract)].sort();

  const mergedContent = [];
  const totalFiles = filesToExtract.length;

  console.log(`Scanning and extracting ${totalFiles} files...`);

  filesToExtract.forEach((filepath, idx) => {
    const relPath = path.relative(workspaceDir, filepath);
    console.log(`[${idx + 1}/${totalFiles}] Extracting: ${relPath}`);

    mergedContent.push('='.repeat(80));
    mergedContent.push(`FILE: ${relPath}`);
    mergedContent.push('='.repeat(80));

    try {
      const content = fs.readFileSync(filepath, 'utf8');
      mergedContent.push(content);
    } catch (err) {
      mergedContent.push(`[Error reading file: ${err.message}]`);
    }

    mergedContent.push('\n\n');
  });

  // Generate timestamp file name (YYYYMMDD_HHMMSS_fff)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  const timestampStr = `${year}${month}${day}_${hours}${minutes}${seconds}_${ms}`;
  const outputFilename = `${timestampStr}.txt`;
  const outputFilePath = path.join(outputDir, outputFilename);

  try {
    fs.writeFileSync(outputFilePath, mergedContent.join('\n'), 'utf8');
    console.log(`\nSuccess! Merged code written to: ${outputFilePath}`);
  } catch (err) {
    console.error(`\nError writing merged file: ${err.message}`);
  }
}

main();
