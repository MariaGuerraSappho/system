/* ...existing code... */
const DB_NAME = "pedagogical-systems";
const STORE = "kv";
let db;
function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function getDB(){ if (db) return db; db = await openDB(); return db; }
async function kvGet(key){
  const db = await getDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess=()=> resolve(req.result || null);
    req.onerror=()=> reject(req.error);
  });
}
async function kvSet(key, val){
  const db = await getDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete=()=> resolve();
    tx.onerror=()=> reject(tx.error);
  });
}
/* ...existing code... */
export async function initStore(){ await getDB(); }
export async function getCurrent(){ return (await kvGet("current")) || null; }
export async function setCurrent(content){ await kvSet("current", content); }
export async function saveVersion(rawText, content){
  const versions = (await kvGet("versions")) || [];
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const meta = { id, timestamp: new Date().toISOString(), size: rawText.length, planets: content.planets.length };
  versions.unshift(meta);
  await kvSet(`version:${id}:raw`, rawText);
  await kvSet(`version:${id}:content`, content);
  await kvSet("versions", versions.slice(0,100));
  return meta;
}
export async function listVersions(){ return (await kvGet("versions")) || []; }
export async function loadVersion(id){
  const raw = await kvGet(`version:${id}:raw`);
  const content = await kvGet(`version:${id}:content`);
  return { raw, content };
}

