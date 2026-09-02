const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist', 'assets');
const polyfill = `if(typeof URL.parse==="undefined"){URL.parse=function(u,b){try{return new URL(u,b)}catch(e){throw new TypeError("Invalid URL: "+u)}};}\n`;

const files = fs.readdirSync(distDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
for (const file of files) {
  const filePath = path.join(distDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('URL.parse') && !content.startsWith('if(typeof URL.parse')) {
    fs.writeFileSync(filePath, polyfill + content);
    console.log(`[PATCHED] ${file}`);
  }
}
console.log('[PATCH DONE]');
