import { extractLinksAsFootnotes } from "./util.js";
/* ...existing code... */
export function buildPrintView(content){
  const pv = document.getElementById("printView");
  if (!content){ pv.innerHTML=""; return; }
  const footnotes = [];
  function lineWithFootnotes(mdLine){
    const { text, notes } = extractLinksAsFootnotes(mdLine);
    if (notes.length){ notes.forEach(n=> footnotes.push(n)); }
    return text;
  }
  const sections = [];
  sections.push(`<h1>${content.sun?.title || "Sun"}</h1>`);
  if (content.sun?.overview) sections.push(`<h2>Overview</h2><div>${escapeHtml(content.sun.overview).split("\n").map(p=> `<p>${lineWithFootnotes(p)}</p>`).join("")}</div>`);
  if (content.sun?.indicativeContent) sections.push(`<h2>Indicative Content</h2><pre>${escapeHtml(content.sun.indicativeContent)}</pre>`);
  if (content.sun?.pedagogy) sections.push(`<h2>Pedagogical Approach</h2><div>${escapeHtml(content.sun.pedagogy)}</div>`);
  if (content.sun?.learningOutcomes) sections.push(`<h2>Learning Outcomes</h2><div>${escapeHtml(content.sun.learningOutcomes)}</div>`);
  sections.push(`<h2>Table of Contents</h2><ol class="toc">` + content.planets.map(p=> `<li>${p.title}</li>`).join("") + `</ol>`);
  content.planets.forEach(p=>{
    sections.push(`<h1>${p.title}</h1>`);
    if (p.overview) sections.push(`<h2>Overview</h2><div>${escapeHtml(p.overview)}</div>`);
    if (p.moons?.length){
      sections.push(`<h2>Moons</h2>` + p.moons.map(m=> `<h3>${m.title}</h3><div>${escapeHtml(m.description)}</div>`).join(""));
    }
    if (p.references?.length){
      sections.push(`<h2>References</h2><ol>${p.references.map(r=> `<li>${escapeHtml(r)}</li>`).join("")}</ol>`);
    }
  });
  if (footnotes.length){
    sections.push(`<h2>Links</h2><ol>` + footnotes.map(f=> `<li>${escapeHtml(f)}</li>`).join("") + `</ol>`);
  }
  pv.innerHTML = sections.join("\n");
}
export async function downloadVisualPNG(){
  const svgEl = document.getElementById("graph"); if(!svgEl) return;
  const s = new XMLSerializer().serializeToString(svgEl);
  const svg = new Blob([s], {type:"image/svg+xml"}); const url = URL.createObjectURL(svg);
  const img = new Image(); img.onload = ()=>{
    const scale = 2, c = document.createElement("canvas"); c.width=img.width*scale; c.height=img.height*scale;
    const ctx = c.getContext("2d"); ctx.fillStyle=getComputedStyle(document.body).backgroundColor; ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0,c.width,c.height); c.toBlob(b=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="solar-system.png"; a.click(); }, "image/png");
    URL.revokeObjectURL(url);
  }; img.src = url;
}
export function downloadVisualSVG(){
  const svgEl = document.getElementById("graph"); if(!svgEl) return;
  const s = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([s], {type:"image/svg+xml"}); const a=document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download="solar-system.svg"; a.click(); URL.revokeObjectURL(a.href);
}
export function downloadMarkdown(content){
  if (!content) return "";
  let out = [];
  if (content.sun){
    out.push(`Sun: ${content.sun.title}`);
    if (content.sun.overview) out.push(`Overview\n${content.sun.overview}`);
    if (content.sun.indicativeContent) out.push(`Indicative Content\n${content.sun.indicativeContent}`);
    if (content.sun.pedagogy) out.push(`Pedagogical Approach\n${content.sun.pedagogy}`);
    if (content.sun.learningOutcomes) out.push(`Learning Outcomes\n${content.sun.learningOutcomes}`);
  }
  content.planets.forEach(p=>{
    out.push(`\nPlanet: ${p.title}`);
    if (p.overview) out.push(`Overview\n${p.overview}`);
    out.push(`Moons`);
    p.moons.forEach(m=> { out.push(`- ${m.title}\n  ${m.description}`); });
    if (p.references?.length){
      out.push(`References`); p.references.forEach(r=> out.push(`- ${r}`));
    }
  });
  return out.join("\n");
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }