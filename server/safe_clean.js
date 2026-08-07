const fs = require('fs');

let content = fs.readFileSync('src/index.ts', 'utf8');

function removeFunction(code, funcName) {
  const pattern = new RegExp(`async function ${funcName}\\s*\\([^)]*\\)\\s*\\{`);
  let match = pattern.exec(code);
  while (match) {
    let start = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let foundFirst = false;
    let i = start;
    while (i < code.length) {
      let c = code[i];
      if ((c === '"' || c === "'" || c === '`') && (i === 0 || code[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = c;
        } else if (stringChar === c) {
          inString = false;
        }
      }

      if (!inString) {
        if (c === '{') {
          braceCount++;
          foundFirst = true;
        } else if (c === '}') {
          braceCount--;
        }
      }

      if (foundFirst && braceCount === 0) {
        let end = i + 1;
        code = code.substring(0, start) + code.substring(end);
        if (code[start] === '\n') {
          code = code.substring(0, start) + code.substring(start + 1);
        }
        break;
      }
      i++;
    }
    match = pattern.exec(code);
  }
  return code;
}

const funcsToRemove = [
  'initAuditLogsTable',
  'initUserAddressesTable',
  'initCategoriesTable',
  'initProductsTable',
  'initProductOptionsTable',
  'initOrdersTable',
  'initRBACTables',
  'initRBACTablesInternal',
  'initReceiversTable',
  'initStoreConfigTable'
];

for (const f of funcsToRemove) {
  content = removeFunction(content, f);
}

// Remove `await initXXX(db);`
content = content.replace(/^\s*await\s+init\w+\(db\);\n?/gm, '');

// Remove `let XXXInitialized = false;`
content = content.replace(/^let\s+\w+Initialized\s*=\s*false;\n?/gm, '');

// Now safely remove inline try-catch CREATE TABLE blocks
// We can find `try { await db.prepare(\n      CREATE TABLE IF NOT EXISTS` and balance braces
function removeInlineCreateTable(code) {
  const pattern = /try\s*\{\s*await\s+db\s*\.\s*prepare\s*\(\s*`\s*CREATE TABLE IF NOT EXISTS/;
  let match = pattern.exec(code);
  while (match) {
    let start = match.index;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let foundFirst = false;
    let i = start;
    let tryEnd = -1;
    while (i < code.length) {
      let c = code[i];
      if ((c === '"' || c === "'" || c === '`') && (i === 0 || code[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = c;
        } else if (stringChar === c) {
          inString = false;
        }
      }

      if (!inString) {
        if (c === '{') {
          braceCount++;
          foundFirst = true;
        } else if (c === '}') {
          braceCount--;
        }
      }

      if (foundFirst && braceCount === 0) {
        tryEnd = i + 1;
        break;
      }
      i++;
    }
    
    // Now we must also remove the catch (e) {} block immediately following it
    if (tryEnd !== -1) {
      let j = tryEnd;
      // Skip whitespace
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code.substring(j, j + 5) === 'catch') {
        let catchStart = j;
        let catchBraceCount = 0;
        let catchFoundFirst = false;
        while (j < code.length) {
          let c = code[j];
          if (c === '{') {
            catchBraceCount++;
            catchFoundFirst = true;
          } else if (c === '}') {
            catchBraceCount--;
          }
          if (catchFoundFirst && catchBraceCount === 0) {
            let end = j + 1;
            // Also step back to include leading whitespace of `try`
            let trueStart = start;
            while (trueStart > 0 && /[ \t]/.test(code[trueStart - 1])) {
              trueStart--;
            }
            code = code.substring(0, trueStart) + code.substring(end);
            if (code[trueStart] === '\n') {
              code = code.substring(0, trueStart) + code.substring(trueStart + 1);
            }
            break;
          }
          j++;
        }
      } else {
        // Just remove try
        code = code.substring(0, start) + code.substring(tryEnd);
      }
    } else {
      break; // prevent infinite loop if brace not found
    }
    match = pattern.exec(code);
  }
  return code;
}

content = removeInlineCreateTable(content);

fs.writeFileSync('src/index.ts', content);
