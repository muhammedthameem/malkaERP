const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src', 'public'];
const additionalFiles = ['index.html'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  content = content.replace(/ClassyERP/gi, 'MalkaERP');
  content = content.replace(/Classy Boutique/gi, 'Malka Boutique');
  content = content.replace(/CLASSY BOUTIQUE/g, 'MALKA BOUTIQUE');
  content = content.replace(/classycouture\.co\.in/gi, 'malka.co.in');
  content = content.replace(/classycouture\.alpy@gmail\.com/gi, 'malka@gmail.com');
  content = content.replace(/classyerp/gi, 'malkaerp');
  content = content.replace(/Classy AI/gi, 'Malka AI');
  content = content.replace(/ClassyAI/g, 'MalkaAI');
  content = content.replace(/classy/gi, 'malka');

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
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.html') || fullPath.endsWith('.json')) {
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
console.log('Deep Replacement complete.');
