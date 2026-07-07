const { Project } = require('ts-morph');
const path = require('path');

const project = new Project();
const useAIAgentPath = path.join(__dirname, 'src', 'renderer', 'hooks', 'useAIAgent.ts');
const sourceFile = project.addSourceFileAtPath(useAIAgentPath);

// 1. Remove the interfaces/constants
const interfaces = ['InsertSuggestion', 'AIMessage', 'AISettings'];
interfaces.forEach(name => {
  const intf = sourceFile.getInterface(name);
  if (intf) {
    intf.remove();
    console.log(`Removed interface ${name}`);
  }
});

const defaultSettings = sourceFile.getVariableStatement('DEFAULT_SETTINGS');
if (defaultSettings) {
  defaultSettings.remove();
  console.log('Removed DEFAULT_SETTINGS');
}

// 2. Add imports
sourceFile.addImportDeclaration({
  namedImports: ['InsertSuggestion', 'AIMessage', 'AISettings', 'DEFAULT_SETTINGS'],
  moduleSpecifier: '../types/aiTypes'
});
console.log('Added aiTypes import.');

// 3. Rename useAI to useAIAgent
const useAIFunc = sourceFile.getFunction('useAI');
if (useAIFunc) {
  useAIFunc.rename('useAIAgent');
  console.log('Renamed useAI to useAIAgent');
}

project.saveSync();
console.log('Successfully transformed useAIAgent.ts');
