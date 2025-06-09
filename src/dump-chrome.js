// dump-chrome.js — Ground‑truth AX tree dumper (DOM XPath **FIXED**)  ⚡
// ----------------------------------------------------------------------------
// * Computes real tag‑based XPaths via **Runtime.callFunctionOn** so paths are
//   no longer empty. This works even when the remote object lives in the page
//   world (avoids Playwright’s handle‑passing limitation).
// * Other logic remains the same.
// ----------------------------------------------------------------------------

import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const xpathFnSource = `function nodeXPath() {
  if (!this || this.nodeType !== 1) return '';
  const seg = [];
  let el = this;
  while (el && el.nodeType === 1) {
    let s = el.nodeName.toLowerCase();
    const sib = Array.from(el.parentNode?.children || []).filter(x => x.nodeName === el.nodeName);
    if (sib.length > 1) s += '[' + (sib.indexOf(el) + 1) + ']';
    seg.unshift(s);
    el = el.parentNode;
  }
  return '/' + seg.join('/');
}`;

async function computeXPaths(client, backendIds) {
  const mapping = {};
  for (const bid of backendIds) {
    try {
      // Resolve to JS objectId
      const { object } = await client.send('DOM.resolveNode', { backendNodeId: bid });
      const { result } = await client.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: xpathFnSource,
        returnByValue: true,
      });
      mapping[bid] = result.value;
    } catch (_) {
      mapping[bid] = '';
    }
  }
  return mapping;
}

function flatten(node, list, parent, xpathMap) {
  const id   = list.length + 1;
  const role = (node.role?.value ?? '').toLowerCase();
  const name = node.name?.value ?? '';
  const childIds = [];
  const rawXp = xpathMap[node.backendDOMNodeId] ?? '';
  const xpath  = rawXp || '/html';        // fallback

  list.push({ id, parentId: parent, role, name, childIds, xpath });

  if (node.children) {
    node.children.forEach(child => {
      const cid = flatten(child, list, id, xpathMap);
      childIds.push(cid);
    });
  }
  return id;
}

async function main() {
  const url = process.argv[2] ?? 'https://example.com';
  const out = process.argv[3] ?? 'chrome_ax.json';

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForLoadState('networkidle');

    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree', {
      interestingOnly: true,
    });

    // Gather backend IDs
    const backendIds = [];
    (function collect(arr) {
      arr.forEach(n => {
        if (n.backendDOMNodeId) backendIds.push(n.backendDOMNodeId);
        if (n.children) collect(n.children);
      });
    })(nodes);

    const xpathMap = await computeXPaths(client, backendIds);

    const flat = [];
    nodes.forEach(root => flatten(root, flat, null, xpathMap));

    await fs.writeFile(out, JSON.stringify(flat, null, 2));
    console.log(`✔ Chrome AX dumped → ${out} (${flat.length} nodes)`);
  } catch (err) {
    console.error('✖ dump-chrome.js failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
