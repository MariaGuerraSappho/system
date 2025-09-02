import { initStore, getCurrent, saveVersion, listVersions, loadVersion, setCurrent } from "./store.js";
import { parseDocument } from "./parser.js";
import { computeDiff, applyUpserts, summariseDiff } from "./diff.js";
import { renderGraph, focusNode, onDoubleClickNode, setContentSource, setOrbiting } from "./graph.js";
import { openPanel, closePanel, setPanelRenderer, openDiffModal, closeDiffModal, renderVersions, openVersions, closeVersions, openSearch, closeSearch, renderSearchResults, setExportHandlers } from "./ui.js";
import { buildPrintView, downloadMarkdown } from "./export.js";
import LZString from "lz-string";

const fileInput = document.getElementById("docFile");
const diffReportEl = document.getElementById("diffReport");
const confirmBtn = document.getElementById("confirmUpdateBtn");
const cancelBtn = document.getElementById("cancelUpdateBtn");
const versionsBtn = document.getElementById("versionsBtn");
const closeVersionsBtn = document.getElementById("closeVersionsBtn");
const exportBtn = document.getElementById("exportBtn");
const searchBtn = document.getElementById("searchBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const orbitBtn = document.getElementById("orbitBtn");
const shareBtn = document.getElementById("shareBtn");

let state = { content: null, diff: null, pendingText: null, versionMeta: null };
await initStore();
const hashData = location.hash.startsWith("#data=") ? location.hash.slice(6) : null;
if (hashData) {
  try { state.content = JSON.parse(LZString.decompressFromEncodedURIComponent(hashData) || "null"); } catch {}
}
setContentSource(() => state.content);

renderGraph({
  onDoubleClick: (node) => openPanel(node, state.content),
});
setPanelRenderer({
  onFocus: (nodeId) => focusNode(nodeId),
  getContent: () => state.content,
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const parsed = parseDocument(text);
  const prev = state.content || { sun: null, planets: [], version: null };
  const diff = computeDiff(prev, parsed);
  state.pendingText = text;
  state.diff = diff;
  diffReportEl.textContent = summariseDiff(diff);
  openDiffModal();
});
confirmBtn.addEventListener("click", async () => {
  if (!state.diff) return;
  const upserted = applyUpserts(state.content, state.diff);
  const version = await saveVersion(state.pendingText, upserted);
  await setCurrent(upserted);
  state.content = upserted;
  location.hash = "data=" + LZString.compressToEncodedURIComponent(JSON.stringify(state.content));
  closeDiffModal();
  renderGraph({ refresh: true, onDoubleClick: (n)=>openPanel(n,state.content) });
  const versions = await listVersions();
  renderVersions(versions);
});
cancelBtn.addEventListener("click", () => {
  state.diff = null; state.pendingText = null; closeDiffModal();
});
versionsBtn.addEventListener("click", async () => {
  const versions = await listVersions(); renderVersions(versions); openVersions();
});
closeVersionsBtn.addEventListener("click", closeVersions);
document.getElementById("versionsList").addEventListener("click", async (e)=>{
  const li = e.target.closest("li[data-version-id]"); if(!li) return;
  const vid = li.dataset.versionId;
  const data = await loadVersion(vid);
  state.content = data.content;
  renderGraph({ refresh:true, onDoubleClick:(n)=>openPanel(n,state.content) });
});
document.getElementById("versionsList").addEventListener("dblclick", async (e)=>{
  const li = e.target.closest("li[data-version-id]"); if(!li) return;
  const vid = li.dataset.versionId;
  const data = await loadVersion(vid);
  await setCurrent(data.content);
});

zoomInBtn.addEventListener("click", ()=> document.dispatchEvent(new CustomEvent("zoomIn")));
zoomOutBtn.addEventListener("click", ()=> document.dispatchEvent(new CustomEvent("zoomOut")));
orbitBtn.addEventListener("click", ()=>{
  const on = orbitBtn.getAttribute("aria-pressed") !== "true";
  orbitBtn.setAttribute("aria-pressed", String(on));
  setOrbiting(on);
});
shareBtn.addEventListener("click", async ()=>{
  if (!state.content) return;
  const url = `${location.origin}${location.pathname}#data=${LZString.compressToEncodedURIComponent(JSON.stringify(state.content))}`;
  await navigator.clipboard.writeText(url);
  shareBtn.textContent = "Link copied"; setTimeout(()=> shareBtn.textContent = "Share", 1200);
});

exportBtn.addEventListener("click", async ()=>{
  setExportHandlers({
    onPdf: async ()=>{
      buildPrintView(state.content);
      window.print();
    },
    onMarkdown: ()=>{
      const blob = new Blob([downloadMarkdown(state.content)], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pedagogical-systems.md";
      a.click();
      URL.revokeObjectURL(a.href);
    }
  });
});
searchBtn.addEventListener("click", openSearch);
document.addEventListener("keydown", (e)=>{
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k") { e.preventDefault(); openSearch(); }
  if (e.key === "Escape") closePanel();
  if (e.key === "+" || e.key === "=") document.dispatchEvent(new CustomEvent("zoomIn"));
  if (e.key === "-" || e.key === "_") document.dispatchEvent(new CustomEvent("zoomOut"));
  if (e.key.toLowerCase() === "f") document.dispatchEvent(new CustomEvent("focusSelected"));
});

document.getElementById("searchInput").addEventListener("input", (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if (!state.content) return;
  const res = [];
  const sun = state.content.sun;
  if (sun && sun.title.toLowerCase().includes(q)) res.push({type:"Sun", id:"sun", title:sun.title});
  state.content.planets.forEach(p=>{
    if (p.title.toLowerCase().includes(q)) res.push({type:"Planet", id:p.id, title:p.title});
    p.moons.forEach(m=>{
      if (m.title.toLowerCase().includes(q) || (m.description||"").toLowerCase().includes(q)) res.push({type:"Moon", id:m.id, title:`${p.title} › ${m.title}`});
    });
    (p.references||[]).forEach((r,i)=>{
      if (r.toLowerCase().includes(q)) res.push({type:"Reference", id:`${p.id}#ref-${i}`, title:`${p.title} › Ref ${i+1}`});
    });
  });
  renderSearchResults(res);
});
document.getElementById("searchResults").addEventListener("click",(e)=>{
  const li = e.target.closest("li[data-id]"); if(!li) return;
  const id = li.dataset.id; 
  if (/#ref-\d+$/.test(id)) {
    const [planetId, refPart] = id.split("#ref-");
    const refIndex = parseInt(refPart, 10);
    closeSearch();
    focusNode(planetId); // center on the planet for context
    // open panel directly to References tab and scroll to item
    openPanel({ type:"Reference", id: planetId, refIndex }, state.content);
  } else {
    closeSearch(); focusNode(id, true);
  }
});