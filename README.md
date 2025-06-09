# AOM-Crawler + AX-Pretty

> **Headless DevTools-quality accessibility inspection for CI & bulk audits**

---

## 1  Overview
This repo delivers a two-step tool-chain that turns any web page into a _diff-friendly_ Accessibility-Tree snapshot:

| Step | Script | What it does |
|------|--------|--------------|
| ① | **`src/aom.js`** | Headless Chromium navigates to a URL, scrolls the page, and emits a richly annotated JSON Accessibility Object Model (AOM). |
| ② | **`src/ax.js`** | Reads that JSON and prints a DevTools-like ASCII tree, collapsing wrappers and merging text nodes for readability. |
| ③ | **`src/test_env.js`** | Optional end-to-end harness that runs both scripts on a list of URLs, compares the result against Chrome’s ground truth, and writes `results/AX_metrics.csv`. |

The pipeline is cross-browser (Chromium/WebKit/Firefox via Playwright) and CI-ready.

---

## 2  Quick-start
```bash
# 0.  Prerequisites: Node ≥20, git, and a Chromium build (Playwright will fetch it)

# 1.  Clone & install
$ git clone https://github.com/alperendavran/AX-Tree--Abstracting-HTML.git
$ npm ci           # installs playwright, chalk, etc.

# 2.  Single-page crawl + pretty print
$ node src/aom.js https://www.trendyol.com/unilever/yumos-sprey-sakura-450-ml-p-800051239 ty_page.json
$ node src/ax.js  ty_page.json --out ty.txt
$ cat ty.txt   # DevTools-style ASCII tree

# 3.  Run the 14-URL benchmark
$ node test_env.js              # default list (see script)
# or
$ node test_env.js urls.txt     # one-URL-per-line custom list
