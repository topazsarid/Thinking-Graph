import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectedGroup,titleLines} from '../src/mapGroups.ts';

test('selection follows cycles and multi-participant connections without unrelated nodes',()=>{
 const ideas=['a','b','c','d','outside'].map(id=>({id}));
 const edges=[{id:'ab',ps:[{idea_id:'a'},{idea_id:'b'}]},{id:'bcd',ps:[{idea_id:'b'},{idea_id:'c'},{idea_id:'d'}]},{id:'ca',ps:[{idea_id:'c'},{idea_id:'a'}]}];
 const expected=['a','b','c','d','edge:ab','edge:bcd','edge:ca'].sort();
 assert.deepEqual(connectedGroup(['a'],ideas,edges).sort(),expected);
 assert.deepEqual(connectedGroup(['edge:bcd'],ideas,edges).sort(),expected);
 assert.deepEqual(connectedGroup(['outside'],ideas,edges),['outside']);
});
test('long titles retain every non-whitespace character without truncation',()=>{
 const title='רעיון ארוך עם טקסט שצריך להופיע בשלמותו WWWWWWWWWWWWWWWWWWWWWWWWWWWW';
 const lines=titleLines(title);
 assert.equal(lines.join('').replace(/\s/g,''),title.replace(/\s/g,''));
 assert.ok(lines.every(line=>Array.from(line).length<=18));
});
