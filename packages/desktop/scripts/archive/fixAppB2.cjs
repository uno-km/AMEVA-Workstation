const fs = require('fs');

let app = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

// 1. Remove shadowed useStates
app = app.replace(/const \[selectedText, setSelectedText\] = useState\(''\)\n/, '');
app = app.replace(/const \[activeBlockId, setActiveBlockId\] = useState<string \| null>\(null\)\n/, '');
app = app.replace(/const \[taggedBlocks, setTaggedBlocks\] = useState<\{ id: string; text: string \}\[\]>\(\[\]\)\n/, '');
app = app.replace(/const \[originalContent, setOriginalContent\] = useState<string>\(''\)\n/, '');
app = app.replace(/const \[lastSavedTime, setLastSavedTime\] = useState<Date \| null>\(null\)\n/, '');
app = app.replace(/const \[selectedSnapshot, setSelectedSnapshot\] = useState<DocumentSnapshot \| null>\(null\)\n/, '');
app = app.replace(/const \[isDiffOpen, setIsDiffOpen\] = useState\(false\)\n/, '');

// 2. Remove activeBlockIdRef declaration
app = app.replace(/const activeBlockIdRef = useRef<string \| null>\(null\)\n/, '');

// 3. Update activeBlockId logic in handleEditorChange
// Old logic:
// const activeId = activeBlockIdRef.current
// if (currentId !== activeBlockIdRef.current) {
//   const prevId = activeBlockIdRef.current
//   activeBlockIdRef.current = currentId
//   setActiveBlockId(currentId)

const activeIdRegex = /const activeId = activeBlockIdRef\.current/g;
app = app.replace(activeIdRegex, 'const activeId = useWorkspaceStore.getState().activeBlockId');

const blockUpdateLogic = `      if (currentId !== activeBlockIdRef.current) {
        const prevId = activeBlockIdRef.current
        activeBlockIdRef.current = currentId
        setActiveBlockId(currentId)`;

const newBlockUpdateLogic = `      const wsState = useWorkspaceStore.getState();
      if (currentId !== wsState.activeBlockId) {
        const prevId = wsState.activeBlockId;
        wsState.setActiveBlockId(currentId);`;

app = app.replace(blockUpdateLogic, newBlockUpdateLogic);

fs.writeFileSync('src/renderer/App.tsx', app, 'utf-8');
console.log('App.tsx B-2 refactoring applied!');
