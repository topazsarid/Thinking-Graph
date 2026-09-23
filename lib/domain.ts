export function candidates(content: string): string[] {
  const marked = [...content.matchAll(/\[\[([^\]\n]{1,180})\]\]/g)].map(m => m[1].trim());
  return [...new Set(marked.length ? marked : content.split(/[\n.!?。]+/).map(s => s.trim()).filter(Boolean).map(s => s.slice(0,180)))].slice(0,8);
}
export function normalize(s:string) { return s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase(); }
export function validText(v:unknown, max=180): string {
  if(typeof v!=='string' || !v.trim() || v.trim().length>max) throw new Error('טקסט חסר או ארוך מדי');
  return v.trim();
}
