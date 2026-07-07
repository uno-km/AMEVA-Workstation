const fs = require('fs');

let panelContent = fs.readFileSync('src/renderer/components/AIPanel.tsx', 'utf-8');
panelContent = panelContent.replace('isGenerating={isGenerating}', '');
panelContent = panelContent.replace('setIsKeySaved,', '');
panelContent = panelContent.replace('currentContent,', '');
panelContent = panelContent.replace('activeBlockId, editor,', '');
panelContent = panelContent.replace('importModel, setDownloadStatus,', '');

fs.writeFileSync('src/renderer/components/AIPanel.tsx', panelContent, 'utf-8');
console.log('Fixed some unused variables');
