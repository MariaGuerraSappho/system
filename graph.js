import * as d3 from "d3";
/* ...existing code... */
let svg, g, zoomBehavior, dataGetter=()=>null;
let orbiting=false, animId=null, planetsAnim=[], lastT=0;
export function setContentSource(fn){ dataGetter = fn; }
export function setOrbiting(on){
  orbiting = !!on; if (animId) cancelAnimationFrame(animId), animId=null;
  if (orbiting){ lastT=0; animId=requestAnimationFrame(tick); }
}
export function renderGraph({ refresh=false, onDoubleClick }={}){
  if (!svg || refresh){
    svg = d3.select("#graph");
    svg.selectAll("*").remove();
    g = svg.append("g");
    zoomBehavior = d3.zoom().scaleExtent([0.3, 5]).on("zoom", (e)=> {
      g.attr("transform", e.transform);
    });
    svg.call(zoomBehavior);
    document.addEventListener("zoomIn", ()=> svg.transition().call(zoomBehavior.scaleBy, 1.2));
    document.addEventListener("zoomOut", ()=> svg.transition().call(zoomBehavior.scaleBy, 0.8));
  }
  const content = dataGetter();
  if (!content){ g.selectAll("*").remove(); return; }
  const { planets } = content;
  const width = svg.node().clientWidth, height = svg.node().clientHeight;
  const center = { x: width/2, y: height/2 };
  planetsAnim = [];
  g.selectAll("*").remove();
  // starfield
  const bg = g.append("g").attr("class","bg");
  const starCount = Math.min(300, Math.floor((width*height)/8000));
  const rng = d3.randomLcg(0.42);
  bg.selectAll("circle.star").data(d3.range(starCount)).enter().append("circle")
    .attr("class","star").attr("cx",()=> rng()*width).attr("cy",()=> rng()*height)
    .attr("r",()=> (rng()*1.5)+0.2).attr("fill", "#9ca3af").attr("opacity",()=> 0.15 + rng()*0.35);
  // palettes
  const planetColor = d3.scaleOrdinal(d3.schemeTableau10);
  const moonColor = d3.interpolateCool;
  // Sun
  const sun = g.append("g").attr("class","node sun").attr("tabindex",0)
    .attr("transform",`translate(${center.x},${center.y})`).on("click", ()=> onDoubleClick({ type:"Sun", id:"sun" }))
    .attr("data-id","sun");
  sun.append("circle").attr("r",34).attr("fill","#fde68a").attr("stroke","#f59e0b").attr("stroke-width",2);
  sun.append("text").attr("y",-46).attr("text-anchor","middle").text(content.sun? content.sun.title : "Sun");
  // Planets and orbits
  const orbitCount = planets.length;
  const maxR = Math.min(width,height)/2 - 60;
  const radiusStep = Math.max(90, maxR / Math.max(orbitCount,1));
  planets.forEach((p, idx)=>{
    const r = radiusStep*(idx+1);
    g.append("circle").attr("cx",center.x).attr("cy",center.y).attr("r",r)
      .attr("fill","none").attr("stroke", d3.color(planetColor(idx)).copy({opacity:0.35}))
      .attr("stroke-dasharray","3,6");
    const angle = (idx/Math.max(orbitCount,1))*Math.PI*2;
    const px = center.x + r*Math.cos(angle), py = center.y + r*Math.sin(angle);
    const pg = g.append("g").attr("class","node planet").attr("transform",`translate(${px},${py})`).on("click", ()=> onDoubleClick({ type:"Planet", id:p.id }))
      .attr("data-id", p.id);
    const pA = { g:pg, r, angle, speed:0.25/(idx+2), cx:center.x, cy:center.y, moons:[] }; planetsAnim.push(pA);
    pg.append("circle").attr("r",18).attr("fill", d3.color(planetColor(idx)).copy({opacity:0.25}))
      .attr("stroke", planetColor(idx)).attr("stroke-width",2);
    pg.append("text").attr("y",-28).attr("text-anchor","middle").text(p.title);
    // moons
    const moons = p.moons||[];
    const mr = 34;
    moons.forEach((m, mi)=>{
      const ang = (mi/Math.max(moons.length,1))*Math.PI*2;
      const mx = mr*Math.cos(ang), my = mr*Math.sin(ang);
      const c = d3.color(moonColor((mi+1)/(moons.length+2)));
      const mg = pg.append("g").attr("class","node moon").attr("transform",`translate(${mx},${my})`).on("click", ()=> onDoubleClick({ type:"Moon", id:m.id }))
        .attr("data-id", m.id);
      pA.moons.push({ g:mg, r:mr, angle:ang, speed:0.6/(mi+3) });
      mg.append("circle").attr("r",7).attr("fill", c.copy({opacity:0.3})).attr("stroke", c.formatHex()).attr("stroke-width",1.5);
      mg.append("text").attr("class","moon-label").attr("y",-12).attr("text-anchor","middle").text(m.title).style("opacity", 0);
      mg.on("mouseenter", function(){ d3.select(this).select("text.moon-label").style("opacity", 1); })
        .on("mouseleave", function(){ d3.select(this).select("text.moon-label").style("opacity", 0); });
    });
  });
}
export function focusNode(id, open=false){
  const content = dataGetter(); if (!content) return;
  let targetG = id==="sun" ? d3.select('[data-id="sun"]') : d3.select(`[data-id="${CSS.escape(id)}"]`);
  if (!targetG || targetG.empty()) return;
  const bbox = targetG.node().getBBox();
  const svgEl = d3.select("#graph");
  const w = svgEl.node().clientWidth, h = svgEl.node().clientHeight;
  const scale = Math.min(2.5, Math.max(1, Math.min(w/(bbox.width+80), h/(bbox.height+80))));
  const tx = -bbox.x*scale + (w - bbox.width*scale)/2;
  const ty = -bbox.y*scale + (h - bbox.height*scale)/2;
  svg.transition().duration(450).call(zoomBehavior.transform, d3.zoomIdentity.translate(tx,ty).scale(scale));
  if (open){
    // trigger panel open via custom event for selected id
    const node = findNodeById(content, id);
    if (node) {
      const evt = new CustomEvent("openPanelFor", { detail: node });
      document.dispatchEvent(evt);
    }
  }
}
function findNodeById(content, id){
  if (id==="sun") return { type:"Sun", id:"sun" };
  for (const p of content.planets){
    if (p.id===id) return { type:"Planet", id:p.id };
    const m = p.moons.find(mm=> mm.id===id);
    if (m) return { type:"Moon", id:m.id, planetId: p.id };
  }
  return null;
}
export function onDoubleClickNode(handler){
  // not used directly; provided via renderGraph options
}
function tick(t){
  if (!orbiting) return;
  if (!lastT) lastT = t;
  const dt = (t - lastT)/1000; lastT = t;
  planetsAnim.forEach(p=>{
    p.angle += p.speed*dt;
    const px = p.cx + p.r*Math.cos(p.angle), py = p.cy + p.r*Math.sin(p.angle);
    p.g.attr("transform",`translate(${px},${py})`);
    p.moons.forEach(m=>{ m.angle += m.speed*dt; const mx=m.r*Math.cos(m.angle), my=m.r*Math.sin(m.angle); m.g.attr("transform",`translate(${mx},${my})`); });
  });
  animId = requestAnimationFrame(tick);
}