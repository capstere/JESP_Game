import test from 'node:test';
import assert from 'node:assert/strict';
import {Workspace} from '../agents/core.mjs';
import {snapshot} from '../agents/evidence.mjs';
test('context preserves real tool IDs and assertion/file-version evidence',()=>{
 const w=new Workspace({web:false});
 w.audit.push({id:'T4',tool:'test_js',ok:true,data:{passed:true,assertions:3,versions:[{name:'logic.js',version:2}]}});
 const e=snapshot(w).recentTools[0];
 assert.equal(e.id,'T4');assert.equal(e.assertions,3);assert.deepEqual(e.versions,[{name:'logic.js',version:2}]);
});
