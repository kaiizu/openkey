const fs = require('fs');
const path = require('path');

const root = String.raw`C:\Users\Dan\AppData\Local\Programs\Attack Shark Driver v4\resources\app\dist\js`;
const out = path.join(__dirname, '..', 'data');
fs.mkdirSync(out, { recursive: true });

function extractBalanced(text, start) {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = null, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced');
}

const idx = fs.readFileSync(path.join(root, 'index.9b3cb33f.js'), 'utf8');
const wpos = idx.indexOf('Wr=[{value:"');
const wstart = idx.indexOf('[', wpos);
const warr = extractBalanced(idx, wstart);
const keymap = eval(warr);
fs.writeFileSync(path.join(out, 'keymap.json'), JSON.stringify(keymap, null, 2));
console.log('keymap entries', keymap.length);

const lay = fs.readFileSync(path.join(root, 'b3c17b87.js'), 'utf8');
const lstart = lay.indexOf('const e=') + 8;
const lend = lay.indexOf(';export', lstart);
const layout = eval('(' + lay.slice(lstart, lend) + ')');
fs.writeFileSync(path.join(out, 'layout.json'), JSON.stringify(layout, null, 2));
console.log('layout keys', Object.keys(layout.layout).length, 'size', layout.width, layout.height);

const model = fs.readFileSync(path.join(root, '1bcd6146.js'), 'utf8');
function arrayAfter(text, marker) {
  const pos = text.indexOf(marker);
  if (pos < 0) throw new Error('missing ' + marker);
  const start = text.indexOf('[', pos);
  return eval(extractBalanced(text, start));
}
const def = arrayAfter(model, 'defaultMatrix=');
const defFn = arrayAfter(model, 'defaultFnMatrix=');
fs.writeFileSync(path.join(out, 'default_matrix.json'), JSON.stringify({ matrix: def, fn: defFn }, null, 2));
console.log('defaultMatrix', def.length, 'fn', defFn.length);
