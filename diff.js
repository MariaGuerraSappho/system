import { slugify, hashText } from "./util.js";
/* ...existing code... */
export function computeDiff(prev, next){
  const created=[], updated=[], unchanged=[], conflicts=[];
  const mapPrevPlanets = new Map((prev.planets||[]).map(p=> [p.slug, p]));
  const nextPlanets = next.planets||[];
  const upserts = [];
  nextPlanets.forEach(np=>{
    const prevMatch = mapPrevPlanets.get(np.slug) || Array.from(mapPrevPlanets.values()).find(p=> p.title===np.title);
    if (!prevMatch){
      created.push({ type:"Planet", slug:np.slug, title:np.title });
      upserts.push({ action:"create", node: np });
    } else {
      const changed = JSON.stringify({t:prevMatch.title,o:prevMatch.overview,m:prevMatch.moons,r:prevMatch.references}) !== JSON.stringify({t:np.title,o:np.overview,m:np.moons,r:np.references});
      if (changed){
        // title change? update previousSlugs
        const titleChanged = prevMatch.title !== np.title;
        const previousSlugs = Array.from(new Set([...(prevMatch.previousSlugs||[]), prevMatch.slug]));
        const merged = { ...prevMatch, ...np, previousSlugs: titleChanged? previousSlugs : (prevMatch.previousSlugs||[]) };
        updated.push({ type:"Planet", slug:np.slug, title:np.title });
        upserts.push({ action:"update", node: merged });
      } else {
        unchanged.push({ type:"Planet", slug:np.slug, title:np.title });
        upserts.push({ action:"noop", node: prevMatch });
      }
    }
  });
  // Moons: per planet
  const moonReports=[];
  nextPlanets.forEach(np=>{
    const prevP = mapPrevPlanets.get(np.slug);
    const prevMoons = new Map((prevP?.moons||[]).map(m=> [m.slug, m]));
    np.moons.forEach(nm=>{
      const pm = prevMoons.get(nm.slug);
      if (!pm){
        moonReports.push({ type:"Moon", planet:np.slug, action:"+", title:nm.title });
      } else {
        const changed = nm.title!==pm.title || nm.description!==pm.description;
        moonReports.push({ type:"Moon", planet:np.slug, action: changed? "~":"=", title:nm.title });
      }
    });
  });
  const versionHash = hashText(JSON.stringify(next).slice(0, 100000));
  return { created, updated, unchanged, conflicts, upserts, moonReports, versionHash, next, prev };
}
export function applyUpserts(prevContent, diff){
  const prev = prevContent || { sun: diff.next.sun || null, planets: [] };
  const map = new Map(prev.planets.map(p=> [p.slug, p]));
  diff.upserts.forEach(u=>{
    if (u.action==="create" || u.action==="update" || u.action==="noop"){
      map.set(u.node.slug, { ...u.node, updatedAt: new Date().toISOString() });
    }
  });
  // carry forward planets not present in next? We keep only those in next (true single source)
  const planets = diff.next.planets.map(p=> map.get(p.slug));
  const sun = diff.next.sun || prev.sun;
  return { sun, planets, version: new Date().toISOString() };
}
export function summariseDiff(diff){
  const lines=[];
  lines.push(`+ Created: ${diff.created.length}`);
  lines.push(`~ Updated: ${diff.updated.length}`);
  lines.push(`= Unchanged: ${diff.unchanged.length}`);
  if (diff.conflicts.length) lines.push(`! Conflicts: ${diff.conflicts.length}`);
  if (diff.moonReports.length){
    lines.push(""); lines.push("Moons:"); 
    diff.moonReports.forEach(r=> lines.push(`${r.action} ${r.title} [${r.planet}]`));
  }
  return lines.join("\n");
}

