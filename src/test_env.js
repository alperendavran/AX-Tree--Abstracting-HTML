// test_env.js — robust end-to-end benchmark runner 🛠️
import { execSync } from 'node:child_process';
import fs   from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

// ───────────────────────── helpers ──────────────────────────
const SLUG_RX = /https?:\/\//;
function slugify(u){return u.replace(SLUG_RX,'').replace(/[^a-z0-9]+/gi,'_').replace(/_+$/,'');}
function key(n){const xp=n.xpath||('id:'+n.id);return `${xp}.toLowerCase()}`;}
function tokens(s){return (s||'').toLowerCase().split(/[\s\W]+/).filter(Boolean);}
const CORE_ROLES=['heading','link','button','navigation','main','banner'];

// ---- Jaccard
function jaccard(a,b){
  const A=new Set(tokens(a)), B=new Set(tokens(b));
  const inter=[...A].filter(x=>B.has(x)).length;
  return inter/ (new Set([...A,...B]).size||1);
}

// ---- non-recursive basic metric
function metricBasic(chrome, ours){
  const mapC=new Map(chrome.map(n=>[key(n),n]));
  const mapO=new Map(ours  .map(n=>[key(n),n]));
  let matched=0, correct=0;
  for(const [k,c] of mapC){
    const o=mapO.get(k);
    if(o){matched++; if(o.role===c.role) correct++;}
  }
  return {
    COV: matched/(chrome.length||1),
    PRE: correct/(ours.length||1),
    REC: correct/(chrome.length||1)
  };
}

// ---- extended metric
function metricExt(chrome, ours){
  const mapC=new Map(chrome.map(n=>[key(n),n]));
  const mapO=new Map(ours  .map(n=>[key(n),n]));
  let matched=0, correct=0,
      txtOk=0, cName=0, oName=0;

  for(const[k,c]of mapC){
    const o=mapO.get(k); if(!o) continue;
    matched++; if(o.role===c.role) correct++;
    if(c.name?.trim()) cName++; if(o.name?.trim()) oName++;
    if(c.name&&o.name&&jaccard(c.name,o.name)>=0.7) txtOk++;
  }

  const roleRec={};
  CORE_ROLES.forEach(r=>{
    const subC=chrome.filter(n=>n.role===r);
    const subO=ours .filter(n=>n.role===r);
    roleRec[r]=metricBasic(subC,subO).REC;
  });

  const INTER=new Set(['button','link','textbox','checkbox','radio','combobox',
                       'searchbox','listbox','switch','spinbutton']);
  const missingLabel=ours.filter(n=>INTER.has(n.role)&&!(n.name&&n.name.trim())).length;

  return {
    ...metricBasic(chrome,ours),
    TXT_PREC: txtOk/(oName||1),
    TXT_REC : txtOk/(cName||1),
    chromeTotal:chrome.length, ourTotal:ours.length,
    matched, correct,
    roleRec, missingLabel
  };
}

// ---- exec wrapper -----------------------------------------------------------
const TIMEOUT=parseInt(process.env.NODE_TIMEOUT||'180000',10);
const RETRY  =parseInt(process.env.RETRY||'1',10);
function run(cmd,label){
  let i=0;
  while(i<=RETRY){
    try{execSync(cmd,{stdio:'inherit',timeout:TIMEOUT}); return true;}
    catch(e){console.error(chalk.red(`✖ ${label} (${i+1}) → ${e.message.split('\n')[0]}`));
             if(++i>RETRY) return false;
             console.log(chalk.yellow('  ↻ retrying…')); }
  }
}

// ---- URL list (kısaltılmış) --------------------------------------------------
// ───────────────────────────────────── URL list ──────────────────────────────
let urls = [
  'https://www.trendyol.com/unilever/yumos-sprey-sakura-450-ml-p-800051239',
  'https://www.wikipedia.org/',
  'https://developer.mozilla.org/en-US/docs/Web/Accessibility',
  'https://www.w3.org/TR/wai-aria-1.2/',
  'https://github.com/',
  'https://www.bbc.com/news',
  'https://web.dev/aria-practices/',
  'https://getbootstrap.com/',
  'https://react.dev/',
  'https://www.salesforce.com/',
  'https://tailwindcss.com/',
  'https://fontawesome.com/',
  'https://www.apple.com/',
  'https://www.microsoft.com/'
];
// CLI list override
if(process.argv[2]&&fs.existsSync(process.argv[2])){
  urls=fs.readFileSync(process.argv[2],'utf8').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
}

// ---- CSV hazırlığı ----------------------------------------------------------
fs.mkdirSync('results',{recursive:true});
const csv=path.join('results','AX_metrics.csv');
fs.writeFileSync(csv,[
  'url','COV','PRE','REC','TXT_PREC','TXT_REC',
  ...CORE_ROLES.map(r=>`REC_${r}`),
  'missingLabel','chrome_total','our_total','matched','correct','totalMs','status'
].join(',')+'\n');

console.log(chalk.cyan(`\nRunning benchmark on ${urls.length} URLs…\n`));

// ---- ana döngü --------------------------------------------------------------
for(const url of urls){
  const t0=Date.now(), slug=slugify(url),
        cJson=`results/${slug}_chrome.json`,
        oJson=`results/${slug}_ours.json`;

  const okDump = run(`node src/dump-chrome.js "${url}" "${cJson}"`,'dump-chrome');
  const okAom  = okDump && run(`node src/aom.js "${url}" "${oJson}"`,'aom');

  let row;
  if(okDump&&okAom){
    try{
      const ch=JSON.parse(fs.readFileSync(cJson)),
            ou=JSON.parse(fs.readFileSync(oJson)),
            m = metricExt(ch,ou);

      row=[
        url,m.COV.toFixed(4),m.PRE.toFixed(4),m.REC.toFixed(4),
        m.TXT_PREC.toFixed(4),m.TXT_REC.toFixed(4),
        ...CORE_ROLES.map(r=>m.roleRec[r].toFixed(4)),
        m.missingLabel,
        m.chromeTotal,m.ourTotal,m.matched,m.correct,
        Date.now()-t0,'OK'
      ].join(',');
      console.log(slug.padEnd(28),'COV',m.COV.toFixed(2),'TXT',m.TXT_REC.toFixed(2));
    }catch(e){
      console.error(chalk.red(`✖ parse ${slug}: ${e.message}`));
      row=[url,'NA','NA','NA','NA','NA',...CORE_ROLES.map(()=> 'NA'),
           0,0,0,0,0,'PARSE_ERR'].join(',');
    }
  }else{
    const stat=okDump?'AOM_ERR':'DUMP_ERR';
    row=[url,'NA','NA','NA','NA','NA',...CORE_ROLES.map(()=> 'NA'),
         0,0,0,0,0,stat].join(',');
  }
  fs.appendFileSync(csv,row+'\n');
}

console.log(chalk.green('\n✔ Finished →'),chalk.underline(csv),'\n');
