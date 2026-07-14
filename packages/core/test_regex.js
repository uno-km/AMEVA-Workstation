const code = `
import React, { useState, useEffect } from 'react';
import { Server, Send, Code, Copy, CheckCircle2 } from 'lucide-react';
`;

let transformed = code;
transformed = transformed.replace(/import\s+React(?:,\s*\{([^}]+)\})?\s+from\s+['"]react['"];?/gs, (m, p1) => {
  return `const React = window.AMEVA_CORE.React;\n${p1 ? `const {${p1}} = React;` : ''}`;
});
transformed = transformed.replace(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"];?/gs, 'const {$1} = window.AMEVA_CORE.LucideIcons;');

console.log(transformed);
