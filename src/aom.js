#!/usr/bin/env node
/* aom.js -------------------------------------------------

 * -------------------------------------------------------------------------- */

/************************ 1. KÜTÜPHANE (ADVANCED_AOM_LIB) *********************/
const ADVANCED_AOM_LIB = String.raw`(function(factory){if(typeof module==='object'&&module.exports){module.exports=factory()}else{(typeof self!=='undefined'?self:this).AdvancedAOM=factory()}})(function(){
  /* ------------ Yardımcılar ------------- */
  const txt = t => (t || '').trim().replace(/\s+/g,' ');

  /* ---------- DOM Düzleştirme ---------- */
  function* flatChildrenAndTextNodes(el){
    const kids = el.shadowRoot ? el.shadowRoot.childNodes : el.childNodes;
    for (const child of kids){
      if(child.nodeType===1){                          // element
        if(child.tagName==='SLOT'){
          for(const n of child.assignedNodes({flatten:true})){
            if(n.nodeType===1){
              if(getComputedStyle(n).display==='contents') yield* flatChildrenAndTextNodes(n);
              else yield n;
            }else if(n.nodeType===3 && txt(n.textContent)) yield n;
          }
        }else if(getComputedStyle(child).display==='contents'){
          yield* flatChildrenAndTextNodes(child);
        }else yield child;
      }else if(child.nodeType===3 && txt(child.textContent)) yield child;
    }
  }

  /* ---------- XPath (debug için) ---------- */
  const xPath=e=>{if(!e||e.nodeType!==1) return'';const seg=[];while(e&&e.nodeType===1){let s=e.nodeName.toLowerCase();const sib=[...e.parentNode?.children||[]].filter(x=>x.nodeName===e.nodeName);if(sib.length>1) s+='['+(sib.indexOf(e)+1)+']';seg.unshift(s);e=e.parentNode;}return'/'+seg.join('/');};

  /* ---------- Rol tabloları ---------- */
  const TAG_ROLES={A:'link',AREA:'link',NAV:'navigation',MAIN:'main',ASIDE:'complementary',FOOTER:'contentinfo',HEADER:'banner',FORM:'form',P:'paragraph',H1:'heading',H2:'heading',H3:'heading',H4:'heading',H5:'heading',H6:'heading',UL:'list',OL:'list',LI:'listitem',DL:'list',DT:'listitem',DD:'listitem',TABLE:'table',TR:'row',TD:'cell',TH:'columnheader',THEAD:'rowgroup',TBODY:'rowgroup',TFOOT:'rowgroup',DETAILS:'group',SUMMARY:'button',IMG:'img',PICTURE:'img',FIGURE:'figure',FIGCAPTION:'caption',VIDEO:'video',AUDIO:'audio',METER:'meter',PROGRESS:'progressbar',SELECT:'combobox',OPTION:'option',OPTGROUP:'group',TEXTAREA:'textbox',SECTION:'region',ARTICLE:'article',DIALOG:'dialog',HR:'separator',FIELDSET:'group',LEGEND:'legend'};
  const INPUT_ROLES={button:'button',submit:'button',reset:'button',checkbox:'checkbox',radio:'radio',range:'slider',search:'searchbox',email:'textbox',tel:'textbox',url:'textbox',text:'textbox',number:'spinbutton',password:'textbox',color:'textbox',file:'textbox',image:'button',date:'datepicker','datetime-local':'datepicker',month:'datepicker',time:'datepicker',week:'datepicker'};
  const implicitRole=el=>{if(el.nodeType!==1) return'';const tn=el.tagName.toUpperCase();if(tn==='INPUT') return INPUT_ROLES[(el.type||'').toLowerCase()]||'textbox';return TAG_ROLES[tn]||'';};
  const role=el=>el.nodeType===1?(el.getAttribute('role')||implicitRole(el)):'';

  /* ---------- skip / flatten ---------- */
  function shouldSkipNode(el){
    if(['SCRIPT','STYLE','TEMPLATE','NOSCRIPT','META','LINK'].includes(el.tagName)) return true;
    const rAttr=el.getAttribute('role');
    if(rAttr==='presentation'||rAttr==='none') return true;              // ARIA presentation
    if(el.getAttribute('aria-hidden')==='true') return true;             // explicit hide
    const cs=getComputedStyle(el);
    return false;
  }
  const shouldFlattenNode=el=>getComputedStyle(el).display==='contents';

  /* ---------- name & description ---------- */
  function accName(el){
    const lbl=el.getAttribute('aria-labelledby');
    if(lbl){const s=lbl.split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean).map(n=>txt(n.textContent)).join(' ');if(s) return s;}
    if(el.hasAttribute('aria-label')) return txt(el.getAttribute('aria-label'));
    const tn=el.tagName.toLowerCase();
    if((tn==='img'||tn==='area'||(tn==='input'&&el.type==='image'))&&el.hasAttribute('alt')) return txt(el.getAttribute('alt'));
    return'';
  }
  const accDescription=el=>{const d=el.getAttribute('aria-describedby');if(d){const s=d.split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean).map(n=>txt(n.textContent)).join(' ');if(s) return s;}if(el.hasAttribute('title')) return txt(el.getAttribute('title'));return'';};

  /* ---------- states & relations ---------- */
  const EXTRA_STATES=['current','busy','live'];
  function ariaStates(el){
    const list=['checked','expanded','selected','disabled','modal','pressed','readonly','required','valuemax','valuemin','valuenow','valuetext','level',...EXTRA_STATES];
    const o={};list.forEach(k=>{const v=el.getAttribute('aria-'+k);if(v!==null) o[k]=v;});
    const tn=el.tagName.toLowerCase();
    if(/^h[1-6]$/.test(tn)) o.level=tn.slice(1);
    if(el.disabled) o.disabled='true';
    if(tn==='input'&&(el.type==='checkbox'||el.type==='radio')&&el.checked) o.checked='true';
    return o;
  }
  const ariaRelations=el=>{const rel={};['labelledby','describedby','controls','owns'].forEach(r=>{const v=el.getAttribute('aria-'+r);if(v) rel[r]=v.split(/\s+/);});return rel;};

  const getElementAttributes=el=>{const o={};for(const a of el.attributes){if(!a.name.startsWith('on')&&a.name!=='style') o[a.name]=a.value;}if(el.tagName==='IFRAME'&&el.getAttribute('src')) o.src=el.getAttribute('src');return o;};
  const getComputedStyles=el=>{const cs=getComputedStyle(el);return ['display','visibility','opacity','color','backgroundColor','fontFamily','fontSize','fontWeight'].reduce((o,k)=>(o[k]=cs[k],o),{});};
  const emptyBounds={x:0,y:0,w:0,h:0,top:0,left:0,bottom:0,right:0};
  const getBoundingBox=el=>{if(el.nodeType!==1) return emptyBounds;const r=el.getBoundingClientRect();if(r.width===0&&r.height===0) return emptyBounds;return {x:r.x,y:r.y,w:r.width,h:r.height,top:r.top,left:r.left,bottom:r.bottom,right:r.right};};

  function checkFocusable(el){if(el.nodeType!==1||el.disabled) return false;const tn=el.tagName.toLowerCase();const ti=parseInt(el.getAttribute('tabindex'),10);if(!isNaN(ti)&&ti>=0) return true;if(tn==='a'&&el.hasAttribute('href')) return true;if(['button','select','textarea','input'].includes(tn)&&el.type!=='hidden') return true;if(el.isContentEditable) return true;if(tn==='summary'&&el.parentNode?.tagName==='DETAILS') return true;return false;}

  /* ---------- DFS ---------- */
  let id=0;const out=[];const add=n=>{out.push(n);return n.id;};

  function dfs(node,parent,depth){
    if(node.nodeType===1){                                // element
      if(shouldSkipNode(node)) return;
      if(shouldFlattenNode(node)){for(const c of flatChildrenAndTextNodes(node)) dfs(c,parent,depth);return;}
      const myId=++id;let r = role(node);if(!r && parent !== null) r = 'generic';const foc=checkFocusable(node);
      let interactive=foc||node.isContentEditable;
      if(['button','link','menuitem','tab','checkbox','radio','slider','textbox','combobox','listbox','searchbox','spinbutton'].includes(r)) interactive=true;
      const nData={id:myId,parentId:parent,childIds:[],depth,xpath:xPath(node),tag:node.tagName.toLowerCase(),role:r,name:accName(node),description:accDescription(node),roledescription:node.getAttribute('aria-roledescription')||'',focusable:foc,interactive,states:ariaStates(node),relations:ariaRelations(node),attrs:getElementAttributes(node),style:getComputedStyles(node),bounds:getBoundingBox(node)};
      add(nData);
      if(parent){const p=out.find(x=>x.id===parent);if(p) p.childIds.push(myId);}  
      if(nData.tag==='li'){const bid=++id;const bullet={id:bid,parentId:myId,childIds:[],depth:depth+1,tag:'bullet',role:'listitemmarker',name:'•',description:'',roledescription:'',focusable:false,interactive:false,states:{},relations:{},attrs:{},style:{display:'list-item'},bounds:{}};add(bullet);nData.childIds.push(bid);}  
      for(const c of flatChildrenAndTextNodes(node)) dfs(c,myId,depth+1);
    }else if(node.nodeType===3){const content=txt(node.textContent);if(!content||!parent) return;const tid=++id;let b=emptyBounds;try{const rng=document.createRange();rng.selectNode(node);const rect=rng.getBoundingClientRect();if(rect.width||rect.height) b={x:rect.x,y:rect.y,w:rect.width,h:rect.height,top:rect.top,left:rect.left,bottom:rect.bottom,right:rect.right};}catch(e){}const tNode={id:tid,parentId:parent,childIds:[],depth,tag:'#text',role:'StaticText',name:content,description:'',roledescription:'',focusable:false,interactive:false,states:{},relations:{},attrs:{},style:{display:'inline'},bounds:b,xpath: (out.find(x=>x.id===parent)?.xpath || '') + '/text()'};add(tNode);const p=out.find(x=>x.id===parent);if(p) p.childIds.push(tid);} }

  function build(root=document){id=0;out.length=0;const base=root.documentElement||root.body||root;dfs(base,null,0);return out;}

  /* ---------- strict filtre ---------- */
  const LANDMARK=['banner','navigation','complementary','region','contentinfo','main'];
  const isLandmark=r=>LANDMARK.includes(r);
  const strict=list=>list.filter(n=> n.role || (n.name&&n.name.trim()) || n.focusable || n.interactive).filter(n=> !(isLandmark(n.role)&&(!n.name||!n.name.trim())) );

  return {buildAdvancedAOM:build,buildAdvancedAOMStrict:root=>strict(build(root))};
});`;

/**************** 2. CRAWLER / PLAYWRIGHT *************************/
const fs = require('fs');
const { chromium } = require('playwright');

function isVisible(n){if(n.role==='StaticText'&&n.name?.trim()) return true;const st=n.style||{};if(st.display==='none'||st.visibility==='hidden'||+st.opacity===0) return false;if(n.bounds&&(n.bounds.w<=0||n.bounds.h<=0)){if(!['bullet','#text','svg','path'].includes(n.tag)) return false;}return true;}
async function autoScroll(page){await page.evaluate(async()=>{await new Promise(res=>{let y=0;const step=800;let c=0;const t=setInterval(()=>{const h=document.body.scrollHeight;window.scrollBy(0,step);y+=step;c++;if(y>=h-window.innerHeight||c>50){clearInterval(t);res();}},200)});});}

(async()=>{
  const[,,url,out='aom.json']=process.argv;if(!url){console.error('kullanım: node aom-crawler.js <url>');process.exit(1);}const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.addInitScript({content:ADVANCED_AOM_LIB});try{await page.goto(url,{waitUntil:'load',timeout:90000});await page.waitForLoadState('networkidle');await autoScroll(page);await page.waitForLoadState('networkidle');const raw=await page.evaluate(()=>window.AdvancedAOM.buildAdvancedAOM(document));const filtered=raw;const idSet=new Set(filtered.map(n=>n.id));filtered.forEach(n=>{if(n.childIds) n.childIds=n.childIds.filter(id=>idSet.has(id));if(n.parentId!==null&&!idSet.has(n.parentId)) n.parentId=null;});if(!filtered.some(n=>n.parentId===null)){const fake=Math.max(...filtered.map(n=>n.id))+1;const roots=filtered.filter(n=>n.parentId===null);filtered.push({id:fake,parentId:null,childIds:roots.map(r=>r.id),tag:'RootWebArea',role:'RootWebArea',name:'',style:{},attrs:{},bounds:{}});roots.forEach(r=>r.parentId=fake);}fs.writeFileSync(out,JSON.stringify(filtered,null,2));console.log('✅',filtered.length,'düğüm yazıldı →',out);}catch(e){console.error('❌',e);}finally{await browser.close();}})();
