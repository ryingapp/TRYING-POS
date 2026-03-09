const fs = require('fs');
const content = fs.readFileSync('client/src/pages/menu.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('function') || line.includes('const') && line.includes('=>')) {
    if (line.trim().startsWith('export') || line.trim().startsWith('function') || line.trim().startsWith('const')) {
       console.log(`${i + 1}: ${line}`);
    }
  }
});