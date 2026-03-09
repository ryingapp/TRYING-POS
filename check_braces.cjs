const fs = require('fs');
const content = fs.readFileSync('client/src/pages/menu.tsx', 'utf8');
const lines = content.split('\n');

let brace = 0;
let paren = 0;
let bracket = 0;
let inQuote = false;
let quoteChar = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (inQuote) {
      if (char === quoteChar && line[j-1] !== '\\') {
        inQuote = false;
      }
    } else {
      if (char === '"' || char === '\'' || char === '`') {
        inQuote = true;
        quoteChar = char;
      } else if (char === '{') brace++;
      else if (char === '}') brace--;
      else if (char === '(') paren++;
      else if (char === ')') paren--;
      else if (char === '[') bracket++;
      else if (char === ']') bracket--;
    }
  }
  
  // If we suspect the error is near line 2108, let's see where the balance is non-zero
  if (i > 2100 && i < 2120) {
      console.log(`Line ${i+1}: Brace: ${brace}, Paren: ${paren}, Bracket: ${bracket} | ${line.trim()}`);
  }
}

if (brace !== 0 || paren !== 0 || bracket !== 0) {
    console.log(`Final Balance -> Brace: ${brace}, Paren: ${paren}, Bracket: ${bracket}`);
}
