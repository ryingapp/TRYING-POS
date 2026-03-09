const fs = require('fs');
const filePath = 'client/src/pages/menu.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of priceModifier with priceAdjustment
const newContent = content.replace(/priceModifier/g, 'priceAdjustment');

if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully replaced priceModifier with priceAdjustment');
} else {
    console.log('No replacement needed or failed');
}
