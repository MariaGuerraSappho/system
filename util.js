/* ...existing code... */
export function slugify(title){
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-");
}
export function hashText(t){
  let h=0; for(let i=0;i<t.length;i++){ h=((h<<5)-h)+t.charCodeAt(i); h|=0; } return (h>>>0).toString(16);
}
export function extractLinksAsFootnotes(line){
  const re = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g; let m; const notes=[];
  let text = line;
  while((m=re.exec(line))){ notes.push(`${m[1]} — ${m[2]}`); }
  text = line.replace(re, (_,a,b)=> `${a} [${notes.length}]`);
  return { text, notes };
}

