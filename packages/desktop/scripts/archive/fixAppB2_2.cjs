const fs = require('fs');

let app = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

app = app.replace(/const \[selectedText, setSelectedText\] = useState\(''\)\r?\n/g, '');
app = app.replace(/const \[activeBlockId, setActiveBlockId\] = useState<string \| null>\(null\)\r?\n/g, '');
app = app.replace(/const \[taggedBlocks, setTaggedBlocks\] = useState<\{ id: string; text: string \}\[\]>\(\[\]\)\r?\n/g, '');
app = app.replace(/const \[originalContent, setOriginalContent\] = useState<string>\(''\)\r?\n/g, '');
app = app.replace(/const \[lastSavedTime, setLastSavedTime\] = useState<Date \| null>\(null\)\r?\n/g, '');
app = app.replace(/const \[selectedSnapshot, setSelectedSnapshot\] = useState<DocumentSnapshot \| null>\(null\)\r?\n/g, '');
app = app.replace(/const \[isDiffOpen, setIsDiffOpen\] = useState\(false\)\r?\n/g, '');

app = app.replace(/const activeBlockIdRef = useRef<string \| null>\(null\)\r?\n/g, '');

fs.writeFileSync('src/renderer/App.tsx', app, 'utf-8');
console.log('Fixed useStates in App.tsx');
