const { test } = require('node:test');
const assert = require('node:assert/strict');
const { articles } = require('../dist/nodes/QiReader/transport');
function context(pages, calls) { return {getNode:()=>({name:'QiReader'}),helpers:{httpRequestWithAuthentication: async (_cred, options)=>{calls.push(options);return {result:pages.shift()};}}}; }
test('preserves timestamp strings and requests descending pages up to limit',async()=>{const calls=[];const out=await articles(context([{entries:[{id:'a',timestamp:'1794903489469120269'},{id:'b',timestamp:'1794903489455374511'}],hasMore:true},{entries:[{id:'c',timestamp:'1794903489455000000'}],hasMore:true}],calls),'qiReaderApi','category-123',0,false,3);assert.equal(out.length,3);assert.equal(calls[1].qs.olderThan,'1794903489455374511');assert.equal(calls[1].qs.count,1);});
test('ascending cursor and stalled pagination are checked',async()=>{const calls=[];await assert.rejects(articles(context([{entries:[{id:'a',timestamp:'123'}],hasMore:true},{entries:[{id:'b',timestamp:'123'}],hasMore:true}],calls),'qiReaderApi','tag-1',1,true,5),/did not advance/);assert.equal(calls[1].qs.newerThan,'123');});
test('an empty final page finishes when service reports no more',async()=>{const calls=[];assert.deepEqual(await articles(context([{entries:[],hasMore:false}],calls),'qiReaderApi','tag-1',0,false,50),[]);});
