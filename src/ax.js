#!/usr/bin/env node
/* ax.js --------------------------------------------------------------

 * ------------------------------------------------------------------------- */

const fs = require('fs');

/* ------------------------- 1) Argüman kontrolü -------------------------- */
if (process.argv.length < 3) {
  console.error('Kullanım: node ax-pretty.js <json> [--show-ignored] [--out <txt>]');
  process.exit(1);
}

const jsonFile = process.argv[2];
const showIgnored = process.argv.includes('--show-ignored');
const outFlagIdx = process.argv.findIndex(a => a === '--out' || a === '-o');
const outFile = outFlagIdx !== -1 ? process.argv[outFlagIdx + 1] : null;

const outStream = outFile ? fs.createWriteStream(outFile, { encoding: 'utf-8' }) : process.stdout;
const println = line => outStream.write(line + '\n');

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));

/* --------------------------- Haritalar & util --------------------------- */
const map = new Map(data.map(n => [n.id, n]));
for (const n of data) n.childNodes = (n.childIds || []).map(id => map.get(id)).filter(Boolean);

let root = data.find(n => n.parentId == null);
if (!root) {
  const childSet = new Set();
  data.forEach(n => (n.childIds || []).forEach(id => childSet.add(id)));
  root = data.find(n => !childSet.has(n.id));
}
if (!root) throw new Error('Kök düğüm bulunamadı');

const TAG_ROLE = {
  p: 'paragraph', aside: 'complementary', nav: 'navigation', main: 'main',
  footer: 'contentinfo', header: 'banner', section: 'region', article: 'article',
  ul: 'list', ol: 'list', li: 'listitem', dl: 'list', dt: 'listitem', dd: 'listitem',
  table: 'table', tr: 'row', td: 'cell', th: 'columnheader', thead: 'rowgroup',
  tbody: 'rowgroup', tfoot: 'rowgroup', img: 'img', video: 'video', audio: 'audio',
  h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  button: 'button', select: 'combobox', textarea: 'textbox', details: 'group', summary: 'button'
};
const INPUT_ROLE = {
  button: 'button', submit: 'button', reset: 'button', checkbox: 'checkbox', radio: 'radio',
  range: 'slider', search: 'searchbox', email: 'textbox', tel: 'textbox', url: 'textbox',
  number: 'spinbutton', password: 'textbox', color: 'textbox', file: 'textbox', image: 'button'
};
function fallbackRole(n) {
  if (!n || !n.tag) return '';
  if (n.tag === 'input') {
    const type = (n.attrs?.type || '').toLowerCase();
    return INPUT_ROLE[type] || 'textbox';
  }
  return TAG_ROLE[n.tag] || '';
}
const effectiveRole = n => n.role || fallbackRole(n) || (n.parentId === null ? 'RootWebArea' : 'generic');

const isWrapper = n => !effectiveRole(n) && !n.name && !n.focusable && !n.interactive;
const isTextNode = n => !effectiveRole(n) && n.name && (!n.childNodes || n.childNodes.length === 0);
const isIgnored = n => !effectiveRole(n) && !n.name && !n.focusable && !n.interactive;

const clip = (s, max = 100) => {
  s = (s || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// 1. Daha agresif generic node gizleme
const shouldHide = n => {
  const role = effectiveRole(n);
  return role === 'generic' && !n.name && !n.focusable && 
         (!n.childNodes || n.childNodes.every(shouldHide));
};

// 2. Chrome'a daha yakın format
function label(n) {
  const role = effectiveRole(n);
  const name = clip(n.name);
  
  // Chrome formatına daha yakın
  let out = role;
  if (name) out += ` "${name}"`;
  if (n.focusable) out += ' focusable';
  if (n.disabled) out += ' disabled';
  
  return out;
}

// 3. Nested generic'leri tamamen atlama
function skipGenericWrappers(node) {
  while (node && effectiveRole(node) === 'generic' && 
         !node.name && node.childNodes?.length === 1) {
    node = node.childNodes[0];
  }
  return node;
}

function collapse(node) {
  let cur = node;
  while (cur && cur.childNodes && cur.childNodes.length === 1) {
    const c = cur.childNodes[0];
    if (isWrapper(cur) || (effectiveRole(cur) === 'generic' && c.name && cur.name === c.name)) {
      cur = c;
    } else break;
  }
  return cur;
}

function visibleChildren(node) {
  const raw = (node.childNodes || []).map(collapse);
  const merged = [];
  let buffer = '';
  const flush = () => {
    if (buffer) {
      merged.push({ role: 'StaticText', name: buffer, childNodes: [], focusable: false, interactive: false, attrs: {} });
      buffer = '';
    }
  };
  raw.forEach(n => {
    if (isTextNode(n)) {
      buffer += (buffer ? ' ' : '') + n.name;
    } else {
      flush();
      merged.push(n);
    }
  });
  flush();
  return merged.filter(x => showIgnored || !isIgnored(x));
}

function print(node, prefix = '', isLast = true, hasParent = false) {
  if (!showIgnored && isIgnored(node)) return;
  const branch = hasParent ? prefix + (isLast ? '└─ ' : '├─ ') : '';
  println(branch + label(node));
  const kids = visibleChildren(node);
  kids.forEach((ch, idx) => {
    const newPref = prefix + (hasParent ? (isLast ? '   ' : '│  ') : '');
    print(ch, newPref, idx === kids.length - 1, true);
  });
}

print(collapse(root));

if (outFile) {
  outStream.end(() => console.error(`✅ Çıktı "${outFile}" dosyasına yazıldı.`));
}