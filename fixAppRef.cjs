const fs = require('fs');

let content = fs.readFileSync('src/renderer/App.tsx', 'utf-8');

// replace currentContentRef usages
content = content.replace(/currentContentRef\.current/g, "useWorkspaceStore.getState().currentContent");
content = content.replace(/useRef\(.*?\)/g, match => match); // just in case

// let's also remove any duplicate React imports if they exist
content = content.replace(/import React, \{ useState, useEffect, useRef, useCallback \} from 'react'\n/, '');
// But the actual import is: import { useState, useEffect, useRef, useCallback } from 'react'
// Let's remove useRef if not used elsewhere, but let's just leave it for safety.

fs.writeFileSync('src/renderer/App.tsx', content, 'utf-8');
console.log("Replaced currentContentRef");
