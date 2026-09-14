import test from 'node:test'
import assert from 'node:assert/strict'
import { phoneUsage, studioUsage, usageMonth } from '../lib/billing/usage'
import type { Job } from '../lib/ai-studio/types'
const job = (overrides: Partial<Job> = {}) => ({id:'a',storeId:1,name:'Vestido',color:'Azul',createdAt:'2026-09-10T12:00:00Z',outputs:['front','back','side','detail'].map(shot=>({shot})),attempts:3,...overrides}) as Job

test('WhatsApp counts connected unique IDs only and excludes removed numbers',()=>{
 const result=phoneUsage({phoneNumbers:[{id:'a',displayPhoneNumber:'+5511999990000',status:'CONNECTED'},{id:'a',displayPhoneNumber:'+5511999990000',status:'CONNECTED'},{id:'b',displayPhoneNumber:'+5511999990001',status:'PENDING'},{id:'c',displayPhoneNumber:'+5511999990002',status:'CONNECTED'}],removedPhoneNumberIds:['c']})
 assert.equal(result.count,1);assert.equal(result.amount,9900);assert.equal(result.numbers.length,2)
})
test('studio isolates store and month, does not charge incomplete sets or attempts',()=>{
 const result=studioUsage([job(),job({id:'other',storeId:2}),job({id:'old',createdAt:'2026-08-01T12:00:00Z'}),job({id:'partial',outputs:[]}),job({id:'retry',attempts:9})],1,'2026-09')
 assert.equal(result.count,2);assert.equal(result.amount,2000);assert.equal(result.jobs.length,3)
})
test('completion month is stable when a completed set is later regenerated',()=>{
 const result=studioUsage([job({createdAt:'2026-08-31T12:00:00Z',completedAt:'2026-09-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',outputs:[]})],1,'2026-09')
 assert.equal(result.count,1);assert.equal(result.jobs[0].legacyDate,false)
 assert.equal(usageMonth(new Date('2026-10-01T01:00:00Z')),'2026-09')
})
