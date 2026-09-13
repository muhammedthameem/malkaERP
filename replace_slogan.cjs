const fs = require('fs');
const path = require('path');

const directoriesToScan = ['src'];

const searchPattern = /Be Unique, Be Malka/gi;
const replacementText = 'Your Complete Destination For Timeless Style';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  content = content.replace(searchPattern, replacementText);

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated slogan in: ${filePath}`);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
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

console.log('Slogan replacement complete.');
