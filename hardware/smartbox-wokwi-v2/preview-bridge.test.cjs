const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createBridge}=require('./preview-bridge.cjs');
test('bridge restricts authentication, route, device, owner injection, expiry and duplicate events',async()=>{
 let writes=0;
 const upstream=http.createServer((req,res)=>{if(req.method==='POST')writes++;res.setHeader('content-type','application/json');res.end(JSON.stringify({received:true,status:'removal_detected'}));});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const config={upstream:'http://127.0.0.1:'+upstream.address().port,deviceId:'WOKWI-PREVIEW-01',bridgeKey:'synthetic-temporary-key',deviceKey:'synthetic-local-key',expiresAt:Date.now()+60000};
 const bridge=createBridge(config);await new Promise(r=>bridge.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+bridge.address().port;
 const call=(path,body,key=config.bridgeKey)=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try {
  assert.equal((await call('/patient/profile')).status,404);
  assert.equal((await call('/api/smartbox/WOKWI-PREVIEW-01/schedule',null,'wrong')).status,401);
  assert.equal((await call('/api/smartbox/weight',{deviceId:'OTHER',weightG:50})).status,403);
  assert.equal((await call('/api/smartbox/weight',{deviceId:config.deviceId,weightG:50,patientId:'other-owner'})).status,403);
  assert.equal((await call('/api/smartbox/weight',{deviceId:config.deviceId,weightG:50,admin:true})).status,400);
  assert.equal((await call('/api/smartbox/OTHER/schedule')).status,404);
  const payload={deviceId:config.deviceId,binIndex:0,timestamp:new Date().toISOString(),confirmed:true,weightBefore:50,weightAfter:45,weightLeftG:45};
  assert.equal((await call('/api/smartbox/dose-event',payload)).status,200);
  assert.equal((await call('/api/smartbox/dose-event',payload)).status,200);assert.equal(writes,1);
  config.expiresAt=0;assert.equal((await call('/api/smartbox/WOKWI-PREVIEW-01/schedule')).status,410);
 } finally {await new Promise(r=>bridge.close(r));await new Promise(r=>upstream.close(r));}
});
