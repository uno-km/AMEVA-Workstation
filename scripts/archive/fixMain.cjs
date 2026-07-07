const fs = require('fs');
const path = require('path');

// 1. Fix src/main/exportersMain.ts
const exportersPath = path.join(__dirname, 'src/main/exportersMain.ts');
let exporters = fs.readFileSync(exportersPath, 'utf8');
exporters = exporters.replace(/outHdr\.eachCell\(cell => \{/g, 'outHdr.eachCell((cell: import("exceljs").Cell) => {');
exporters = exporters.replace(/row\.eachCell\(cell => \{/g, 'row.eachCell((cell: import("exceljs").Cell) => {');
exporters = exporters.replace(/return cells\.map\(cell => \{/g, 'return cells.map((cell: import("exceljs").Cell) => {');
exporters = exporters.replace(/block\.children\.forEach\(c => \{/g, 'block.children.forEach((c: any) => {'); // Wait, NO ANY!
exporters = exporters.replace(/block\.children\.forEach\(\(c: any\) => \{/g, 'block.children.forEach((c: unknown) => {');
exporters = exporters.replace(/block\.children\.forEach\(c => \{/g, 'block.children.forEach((c: unknown) => {');
fs.writeFileSync(exportersPath, exporters);

// 2. Fix src/main/index.ts
const indexPath = path.join(__dirname, 'src/main/index.ts');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/lines\.map\(l => l\.trim\(\)\)\.filter\(l => l && l !== 'Name'\)/g, 'lines.map((l: string) => l.trim()).filter((l: string) => l && l !== "Name")');
fs.writeFileSync(indexPath, index);

// 3. Fix src/main/preload.ts
const preloadPath = path.join(__dirname, 'src/main/preload.ts');
let preload = fs.readFileSync(preloadPath, 'utf8');
preload = preload.replace(/import \{ ipcRenderer, webFrame \} from 'electron'/g, 'import { ipcRenderer } from \'electron\'');
fs.writeFileSync(preloadPath, preload);

// 4. Fix vite.config.ts
const vitePath = path.join(__dirname, 'vite.config.ts');
let vite = fs.readFileSync(vitePath, 'utf8');
vite = vite.replace(/browserField: false,/g, '/* browserField: false */');
fs.writeFileSync(vitePath, vite);

console.log('Fixed main/vite errors.');
