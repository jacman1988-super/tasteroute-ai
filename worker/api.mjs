const cities={lisbon:'Lisbon Portugal',krakow:'Krakow Poland',warsaw:'Warsaw Poland',barcelona:'Barcelona Spain'};
const interests={coffee:'coffee',food:'food',art:'art',music:'music',nature:'nature',history:'history'};
const encoder=new TextEncoder(),decoder=new TextDecoder(),eventBase='https://hackathon.api.qloo.com';
const object=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const limited=(v,n=300)=>typeof v==='string'?v.slice(0,n):undefined;
function failure(code,status=400){const e=new Error(code);e.status=status;return e;}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function un64(s){if(!/^[A-Za-z0-9_-]+$/.test(s))throw failure('INVALID_CHOICE');return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function signingKey(secret){return crypto.subtle.importKey('raw',encoder.encode('TasteRoute-choice-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
async function issue(value,secret){const data=b64(encoder.encode(JSON.stringify(value))),sig=await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(data));return data+'.'+b64(new Uint8Array(sig));}
async function verify(token,secret,now){if(typeof token!=='string'||token.length>1800)throw failure('INVALID_CHOICE');const parts=token.split('.');if(parts.length!==2||!await crypto.subtle.verify('HMAC',await signingKey(secret),un64(parts[1]),encoder.encode(parts[0])))throw failure('INVALID_CHOICE');let p;try{p=JSON.parse(decoder.decode(un64(parts[0])));}catch{throw failure('INVALID_CHOICE');}if(!object(p,['id','interest','exp'])||typeof p.id!=='string'||p.id.length>300||!Object.hasOwn(interests,p.interest)||!Number.isSafeInteger(p.exp))throw failure('INVALID_CHOICE');if(p.exp<=now||p.exp>now+600001)throw failure('CHOICE_EXPIRED');return p;}
async function boundedJson(response,limit=1048576,code='PROVIDER_RESPONSE',status=502){let count=0,parts=[];for await(const chunk of response.body){count+=chunk.length;if(count>limit)throw failure(code,status);parts.push(chunk);}const bytes=new Uint8Array(count);let off=0;for(const part of parts){bytes.set(part,off);off+=part.length;}try{return JSON.parse(decoder.decode(bytes));}catch{throw failure(code,status);}}
async function query(path,params,key,fetchImpl){
  const url=new URL(path,eventBase);for(const [name,value]of Object.entries(params))url.searchParams.set(name,Array.isArray(value)?value.join(','):String(value));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{let r;try{r=await fetchImpl(url.href,{headers:{'X-Api-Key':key,'Accept':'application/json'},redirect:'manual',signal:controller.signal});}
    catch(error){const message=String(error.message);const kind=/redirect/i.test(message)?'REDIRECT_MODE':/timeout|signal|abort/i.test(message)?'TIMEOUT_API':/url|request|resource|argument/i.test(message)?'FETCH_ARGUMENT':/invocation|interface/i.test(message)?'FETCH_BINDING':/context|I\/O/i.test(message)?'REQUEST_CONTEXT':'NETWORK';console.warn('Qloo transport diagnostic',{name:String(error.name).slice(0,40),kind});throw failure('PROVIDER_UNAVAILABLE',502);}
    // Never forward the private header to a redirected destination.
    if(r.status>=300&&r.status<400)throw failure('PROVIDER_REDIRECT',502);
    if(!r.ok){console.warn('Qloo HTTP diagnostic',{status:r.status});throw failure(r.status===429?'BUSY':r.status===401||r.status===403?'PROVIDER_AUTH':'PROVIDER_HTTP_'+r.status,r.status===429?429:502);}
    const data=await boundedJson(r);if(!data.results||typeof data.results!=='object')throw failure('PROVIDER_RESPONSE',502);return data;
  }finally{clearTimeout(timer);}
}
export function createApi({fetchImpl=(...args)=>globalThis.fetch(...args),now=Date.now}={}){
  const clients=new Map();let globalWindow=now(),globalCalls=0,active=0;
  return async(request,env)=>{
    const send=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    let acquired=false;
    try{const url=new URL(request.url);if(!['/api/tags','/api/recommendations'].includes(url.pathname))return send(404,{error:{code:'NOT_FOUND'}});if(request.method!=='POST')return send(405,{error:{code:'METHOD'}});if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw failure('ORIGIN_REJECTED',403);if(!env.QLOO_API_KEY)throw failure('NOT_CONFIGURED',503);
      const time=now(),client=request.headers.get('cf-connecting-ip')??'local';
      if(time-globalWindow>=60000){globalWindow=time;globalCalls=0;clients.clear();}
      if(globalCalls>=30||active>=2||(clients.get(client)??0)>=12)throw failure('BUSY',429);globalCalls++;clients.set(client,(clients.get(client)??0)+1);
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw failure('INVALID_INPUT');const input=await boundedJson(request,8192,'INVALID_INPUT',400);if(active>=2)throw failure('BUSY',429);active++;acquired=true;
      if(url.pathname==='/api/tags'){if(!object(input,['interest'])||typeof input.interest!=='string'||!Object.hasOwn(interests,input.interest))throw failure('INVALID_INPUT');const data=await query('/v2/tags',{'filter.query':interests[input.interest],'feature.semantic_search':true,take:5},env.QLOO_API_KEY,fetchImpl);if(!Array.isArray(data.results.tags))throw failure('PROVIDER_RESPONSE',502);const candidates=[];for(const tag of data.results.tags.slice(0,5)){const id=limited(tag.id??tag.tag_id),name=limited(tag.name),type=limited(tag.type??tag.subtype);if(id&&name&&type)candidates.push({id,name,type,choiceToken:await issue({id,interest:input.interest,exp:time+600000},env.QLOO_API_KEY)});}return send(200,{source:'qloo',status:candidates.length?'ok':'empty',candidates,requiresChoice:true});}
      if(!object(input,['city','choiceTokens','limit'])||typeof input.city!=='string'||!Object.hasOwn(cities,input.city)||!Array.isArray(input.choiceTokens)||!input.choiceTokens.length||input.choiceTokens.length>6)throw failure('INVALID_INPUT');const limit=input.limit??12;if(!Number.isInteger(limit)||limit<1||limit>20)throw failure('INVALID_INPUT');const selected=await Promise.all(input.choiceTokens.map(t=>verify(t,env.QLOO_API_KEY,time))),ids=[...new Set(selected.map(t=>t.id))],coffee=[...new Set(selected.filter(t=>t.interest==='coffee').map(t=>t.id))];
      const params={'filter.type':'urn:entity:place','signal.interests.tags':ids,'operator.signal.interests.tags':'union','filter.location.query':cities[input.city],'feature.explainability':true,take:limit};if(coffee.length){params['filter.tags']=coffee;params['operator.filter.tags']='union';}
      const data=await query('/v2/insights',params,env.QLOO_API_KEY,fetchImpl);if(!Array.isArray(data.results.entities))throw failure('PROVIDER_RESPONSE',502);const seen=new Set(),places=[];for(const entity of data.results.entities.slice(0,limit)){const id=limited(entity.entity_id??entity.id),name=limited(entity.name);if(!id||!name||seen.has(id))continue;seen.add(id);places.push({id,name,type:limited(entity.type),description:limited(entity.properties?.short_description??entity.properties?.description,2000),address:limited(entity.properties?.address,1000)});}return send(200,{source:'qloo',status:places.length?'ok':'empty',city:input.city,places,provenance:{source:'Qloo API',workflow:'recommend',endpoint:'/v2/insights'}});
    }catch(e){return send(e.status??500,{error:{code:e.status?e.message:'SERVER_ERROR'}});}finally{if(acquired)active--;}
  };
}
