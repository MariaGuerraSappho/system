import { marked } from "marked";
/* ...existing code... */
const panelEl = document.getElementById("panel");
const panelTitle = document.getElementById("panelTitle");
const panelTabs = document.getElementById("panelTabs");
const panelContent = document.getElementById("panelContent");
const copyMdBtn = document.getElementById("copyMdBtn");
const closePanelBtn = document.getElementById("closePanelBtn");
const diffModal = document.getElementById("diffModal");
const versionsDrawer = document.getElementById("versionsDrawer");
const versionsBtn = document.getElementById("versionsBtn");
const versionsList = document.getElementById("versionsList");
const searchModal = document.getElementById("searchModal");
/* ...existing code... */
const renderer = new marked.Renderer();
const _link = renderer.link;
renderer.link = function(href, title, text){
  const html = _link.call(this, href, title, text);
  return html.replace("<a ", '<a target="_blank" rel="noopener noreferrer" ');
};
marked.setOptions({ renderer });
let panelCtx = { getContent: ()=>null, onFocus: ()=>{} };
export function setPanelRenderer(ctx){ panelCtx = ctx; }
export function openPanel(node, content){
  const data = content || panelCtx.getContent();
  if (!data) return;
  if (node.type==="Sun"){
    panelTitle.textContent = data.sun?.title || "Sun";
    renderTabs(["Overview","Indicative Content","Pedagogy","Learning Outcomes"], (tab)=> {
      const key = tabMap(tab);
      panelContent.innerHTML = marked.parse((data.sun?.[key]||"").trim());
    });
  } else if (node.type==="Planet" || node.type==="Reference"){
    const p = data.planets.find(x=> x.id===node.id); if(!p) return;
    panelTitle.textContent = p.title;
    const initialTab = node.type==="Reference" ? "References" : "Overview";
    renderTabs(["Overview","Moons","References"], (tab)=> {
      if (tab==="Overview") panelContent.innerHTML = marked.parse(p.overview||"");
      if (tab==="Moons") panelContent.innerHTML = p.moons.map(m=> `<h3>${m.title}</h3>${marked.parse(m.description||"")}`).join("");
      if (tab==="References") panelContent.innerHTML = `<ol>${(p.references||[]).map((r,i)=> `<li data-ref-index="${i}">${marked.parseInline(r)}</li>`).join("")}</ol>`;
      if (node.type==="Reference" && tab==="References" && Number.isInteger(node.refIndex)) {
        const target = panelContent.querySelector(`li[data-ref-index="${node.refIndex}"]`);
        if (target) { target.scrollIntoView({ block:"center", behavior:"smooth" }); target.classList.add("focus-ref"); setTimeout(()=> target.classList.remove("focus-ref"), 1200); }
      }
    }, initialTab);
  } else if (node.type==="Moon"){
    const p = data.planets.find(x=> x.moons.some(m=> m.id===node.id)); if(!p) return;
    const m = p.moons.find(mm=> mm.id===node.id);
    panelTitle.textContent = `${p.title} — ${m.title}`;
    renderTabs(["Notes"], ()=> { panelContent.innerHTML = marked.parse(m.description||""); });
  }
  panelEl.hidden = false; panelEl.setAttribute("aria-modal","false");
}
function tabMap(tab){
  return tab==="Indicative Content" ? "indicativeContent" : tab==="Pedagogy" ? "pedagogy" : tab==="Learning Outcomes" ? "learningOutcomes" : tab.toLowerCase();
}
function renderTabs(names, onSelect, initialName){
  panelTabs.innerHTML = "";
  names.forEach((n,i)=>{
    const b = document.createElement("button");
    b.role="tab"; b.textContent=n; b.setAttribute("aria-selected", (initialName? n===initialName : i===0) ? "true" : "false");
    b.addEventListener("click", ()=>{
      [...panelTabs.children].forEach(c=> c.setAttribute("aria-selected","false"));
      b.setAttribute("aria-selected","true"); onSelect(n);
    });
    panelTabs.appendChild(b);
  });
  onSelect(initialName || names[0]);
}
export function closePanel(){ panelEl.hidden = true; }
/* ...existing code... */
export function openDiffModal(){ diffModal.hidden = false; }
export function closeDiffModal(){ diffModal.hidden = true; }
/* ...existing code... */
export function renderVersions(versions){
  versionsList.innerHTML = versions.map(v=> `<li data-version-id="${v.id}" tabindex="0"><strong>${new Date(v.timestamp).toLocaleString()}</strong> — ${v.planets} planets · ${v.size} chars</li>`).join("");
}
export function openVersions(){ versionsDrawer.hidden = false; versionsBtn.setAttribute("aria-expanded","true"); }
export function closeVersions(){ versionsDrawer.hidden = true; versionsBtn.setAttribute("aria-expanded","false"); }
/* ...existing code... */
export function openSearch(){ searchModal.hidden = false; document.getElementById("searchInput").focus(); }
export function closeSearch(){ searchModal.hidden = true; }
export function renderSearchResults(items){
  const ul = document.getElementById("searchResults");
  ul.innerHTML = items.map(it=> `<li data-id="${it.id}" tabindex="0"><small>${it.type}</small> ${it.title}</li>`).join("");
}
/* ...existing code... */
document.addEventListener("openPanelFor", (e)=> openPanel(e.detail, panelCtx.getContent()));
copyMdBtn.addEventListener("click", async ()=>{
  const c = panelCtx.getContent(); if(!c) return;
  const sel = panelTitle.textContent;
  let md = "";
  if (sel=== (c.sun?.title||"Sun")) {
    md = `Sun: ${c.sun?.title||"Sun"}\nOverview\n${c.sun?.overview||""}\n`;
  } else {
    const p = c.planets.find(pl=> sel===pl.title || sel.startsWith(pl.title+" —"));
    if (p && !sel.includes(" — ")){
      md = `Planet: ${p.title}\nOverview\n${p.overview}\nMoons\n${p.moons.map(m=> `- ${m.title}\n  ${m.description}`).join("\n")}\nReferences\n${(p.references||[]).map(r=> `- ${r}`).join("\n")}\n`;
    } else if (p){
      const mt = sel.split(" — ")[1];
      const m = p.moons.find(mm=> mm.title===mt);
      md = `- ${m.title}\n  ${m.description}\n`;
    }
  }
  await navigator.clipboard.writeText(md.trim());
});
closePanelBtn.addEventListener("click", ()=> closePanel());
/* ...existing code... */
export function setExportHandlers({ onPdf, onMarkdown }){
  // remove existing menu if any
  const existing = document.getElementById("exportMenu");
  if (existing) existing.remove();
  const menu = document.createElement("div");
  menu.id = "exportMenu";
  menu.style.position="fixed"; menu.style.zIndex="1000";
  menu.style.background="var(--bg)"; menu.style.border="1px solid #e5e7eb"; menu.style.padding="6px 8px"; menu.style.borderRadius="8px";
  menu.innerHTML = `<button id="dlPdf" class="ghost">Download PDF (Linear Text)</button><br/><button id="dlMd" class="ghost">Download Markdown</button>`;
  document.body.appendChild(menu);
  // position near Export button
  const btn = document.getElementById("exportBtn");
  const r = btn.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 8)}px`;
  menu.style.left = `${Math.max(16, Math.round(r.right - 240))}px`;
  function close(){ menu.remove(); }
  menu.addEventListener("click",(e)=>{
    if (e.target.id==="dlPdf"){ onPdf(); close(); }
    if (e.target.id==="dlMd"){ onMarkdown(); close(); }
  });
  setTimeout(()=> {
    document.addEventListener("click", (e)=> { if(!menu.contains(e.target)) close(); }, { once:true });
  }, 0);
}