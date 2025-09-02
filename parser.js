import { slugify } from "./util.js";
/* ...existing code... */
export function parseDocument(text){
  const lines = text.replace(/\r\n/g,"\n").split("\n");
  let i=0, sun=null, planets=[]; let currentPlanet=null;
  function readBlock(startIdx){
    const buf=[]; let j=startIdx;
    while(j<lines.length && lines[j].trim()!=="" && !/^(Sun:|Planet: )/.test(lines[j])){ buf.push(lines[j]); j++; }
    // allow empty lines inside markdown: keep going until next explicit header
    while(j<lines.length && !/^(Sun:|Planet: )/.test(lines[j])){ buf.push(lines[j]); j++; }
    return { text: buf.join("\n").trim(), next:j };
  }
  function parseIdFromTitle(raw){
    const m = raw.match(/\[id:\s*([A-Za-z0-9-_]+)\s*\]\s*$/);
    const title = raw.replace(/\[id:[^\]]+\]\s*$/,'').trim();
    return { title, id: m?m[1]:null };
  }
  while(i<lines.length){
    const line = lines[i].trim();
    if (line.startsWith("Sun:")){
      const { title } = parseIdFromTitle(line.slice(4).trim());
      // Sun sections
      const getSection = (name)=>{
        const idx = lines.findIndex((l,ii)=> ii>=i && l.trim()===name);
        if (idx===-1) return "";
        const nextIdx = ["Overview","Indicative Content","Pedagogical Approach","Learning Outcomes","Planet:"].map(n=>n).reduce((acc, n)=>{
          const j = lines.findIndex((l,ii)=> ii>idx && (l.trim()===n || l.startsWith("Planet:")));
          return acc===-1? j : (j!==-1? Math.min(acc,j): acc);
        }, -1);
        const from = idx+1, to = nextIdx===-1? lines.length : nextIdx;
        return lines.slice(from,to).join("\n").trim();
      };
      sun = {
        title,
        overview: getSection("Overview"),
        indicativeContent: getSection("Indicative Content"),
        pedagogy: getSection("Pedagogical Approach"),
        learningOutcomes: getSection("Learning Outcomes"),
        version: ""
      };
      // advance i to after sun sections
      i = lines.findIndex((l,ii)=> ii>i && l.startsWith("Planet:"));
      if (i===-1) i = lines.length;
      continue;
    }
    if (line.startsWith("Planet:")){
      const { title, id } = parseIdFromTitle(line.slice(8).trim());
      currentPlanet = {
        id: id || slugify(title),
        title,
        overview: "",
        moons: [],
        references: [],
        slug: slugify(title),
        previousSlugs: [],
        updatedAt: new Date().toISOString()
      };
      i++;
      // sections: Overview, Moons, References
      const start = i;
      const until = lines.findIndex((l,ii)=> ii>=start && l.startsWith("Planet:"));
      const block = lines.slice(start, until===-1? lines.length: until);
      // parse sections inside block
      const idxOverview = block.findIndex(l=> l.trim()==="Overview");
      if (idxOverview!==-1){
        const next = block.findIndex((l,ii)=> ii>idxOverview && (l.trim()==="Moons" || l.trim()==="References"));
        currentPlanet.overview = block.slice(idxOverview+1, next===-1? block.length: next).join("\n").trim();
      }
      const idxMoons = block.findIndex(l=> l.trim()==="Moons");
      if (idxMoons!==-1){
        let j = idxMoons+1;
        while(j<block.length){
          const ln = block[j];
          if (ln.trim()==="References") break;
          const mm = ln.match(/^\s*-\s+(.+)$/);
          if (mm){
            const { title: mtitle, id: mid } = (function(raw){
              const m= raw.match(/\[id:\s*([A-Za-z0-9-_]+)\s*\]\s*$/);
              const t= raw.replace(/\[id:[^\]]+\]\s*$/,'').trim();
              return { title: t, id: m?m[1]:null };
            })(mm[1]);
            j++;
            // collect indented description lines
            const descLines=[];
            while(j<block.length && (block[j].startsWith("  ") || block[j].startsWith("\t"))){
              descLines.push(block[j].replace(/^(\s{2,}|\t)/,''));
              j++;
            }
            currentPlanet.moons.push({
              id: mid || `${slugify(currentPlanet.title)}--${slugify(mtitle)}`,
              title: mtitle,
              description: descLines.join("\n").trim(),
              slug: slugify(mtitle),
              updatedAt: new Date().toISOString()
            });
          } else { j++; }
        }
      }
      const idxRefs = block.findIndex(l=> l.trim()==="References");
      if (idxRefs!==-1){
        const refs = [];
        for(let r=idxRefs+1;r<block.length;r++){
          const ln2 = block[r];
          if (ln2.trim().startsWith("- ")){
            refs.push(ln2.replace(/^\s*-\s*/,''));
          } else if (ln2.trim()==="") {
            continue;
          } else {
            // stop on next section (unlikely inside planet block)
          }
        }
        currentPlanet.references = refs;
      }
      planets.push(currentPlanet);
      i = until===-1? lines.length : (start + block.length);
      continue;
    }
    i++;
  }
  // de-dup moons within a planet
  planets.forEach(p=>{
    const seen = {};
    p.moons = p.moons.map(m=>{
      const base = m.slug;
      if (!seen[base]) { seen[base]=1; return m; }
      seen[base]++;
      const newSlug = `${base}-${seen[base]}`;
      return { ...m, slug: newSlug, title: m.title + ` (${seen[base]})` };
    });
  });
  return { sun, planets };
}

