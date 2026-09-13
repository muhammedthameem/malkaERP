const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src', 'public'];
const additionalFiles = ['index.html'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Perform replacements (order matters)
  content = content.replace(/Classy ERP/gi, 'Malka ERP');
  content = content.replace(/Classy Couture/gi, 'Malka');
  // Avoid replacing "@classy.com" or inside class="classy" - let's be careful. 
  // We'll replace standalone "Classy" with "Malka".
  content = content.replace(/\bClassy\b/g, 'Malka');
  content = content.replace(/\bclassy\b/g, 'malka');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.html') || fullPath.endsWith('.css') || fullPath.endsWith('.json')) {
      replaceInFile(fullPath);
    }
  }
}

// Start processing
directoriesToScan.forEach(dir => {
  if (fs.existsSync(dir)) {
    scanDir(dir);
  }
});

additionalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    replaceInFile(file);
  }
});

console.log('Replacement complete.');
