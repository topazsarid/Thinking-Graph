import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchIdeas,normalize} from '../src/mapSearch.ts';

const ideas=[{id:'a',title:'השערה: הליכה תורמת לריכוז',summary:''},{id:'b',title:'שינה',summary:'מנוחה משפרת קשב'},{id:'c',title:'ריכוז',summary:'',status:'rejected'}];
const links=[{workspace_id:'w1',idea_id:'a'},{workspace_id:'w2',idea_id:'b'}];

test('finds by title words, ignoring filler words and a Hebrew prefix letter',()=>{
 const hits=searchIdeas('איפה הרעיון שלי על הריכוז?',ideas,links);
 assert.deepEqual(hits.map(h=>h.id),['a']);
 assert.deepEqual(hits[0].workspaceIds,['w1']);
});
test('summary matches count, rejected ideas never match, nothing found returns empty',()=>{
 assert.deepEqual(searchIdeas('קשב',ideas,links).map(h=>[h.id,h.workspaceIds[0]]),[['b','w2']]);
 assert.deepEqual(searchIdeas('מוזיקה',ideas,links),[]);
 assert.deepEqual(searchIdeas('מה איפה',ideas,links),[]);
});
test('normalize strips niqqud and punctuation',()=>{
 assert.equal(normalize('שָׁלוֹם, עוֹלָם!'),'שלום עולם');
});
