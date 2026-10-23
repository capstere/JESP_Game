import test from 'node:test';import assert from 'node:assert/strict';
import {roleBudget} from '../agents/backend.mjs';
test('auto reserves reflective budget for architect and critic, rather than spending all tokens on each tool call',()=>{
 assert.deepEqual(roleBudget({reasoning:'auto',role:'work'}),{effort:'low',maxTokens:6144});
 assert.deepEqual(roleBudget({reasoning:'auto',role:'architect'}),{effort:'medium',maxTokens:3072});
 assert.deepEqual(roleBudget({reasoning:'auto',role:'repair'}),{effort:'medium',maxTokens:8192});
 assert.deepEqual(roleBudget({reasoning:'auto',role:'critic'}),{effort:'medium',maxTokens:8192});
});
test('explicit high setting is respected, not silently presented as high while requesting low',()=>{
 assert.deepEqual(roleBudget({reasoning:'high',role:'work'}),{effort:'high',maxTokens:12288});
});
