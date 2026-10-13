const object=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export async function runTasteAgent({city,days,pace,tags,decide,recommend,onTrace=()=>{},signal}) {
  if(!['lisbon','krakow','warsaw','barcelona'].includes(city)||![1,2,3].includes(days)||!['calm','balanced','active'].includes(pace)||!Array.isArray(tags)||tags.length<1||tags.length>6)throw Error('INVALID_PLAN');
  const goal={city,days,pace,tags:tags.map(t=>({name:String(t.name).slice(0,80),type:String(t.type).slice(0,100)}))};
  const trace=[]; const record=(stage,details)=>{const entry={stage,...details};trace.push(entry);onTrace(entry);};
  const firstSchema={type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['recommend_places','finish']}}};
  const first=await decide({goal,stage:'discover',schema:firstSchema,places:[],signal});
  if(signal?.aborted)throw Error('CANCELLED');
  if(!object(first,['action'])||first.action!=='recommend_places')throw Error('NO_TOOL_DECISION');
  record('model',{action:first.action});
  const result=await recommend();
  if(signal?.aborted)throw Error('CANCELLED');
  if(result?.source!=='qloo'||!Array.isArray(result.places)||result.places.length>20||result.places.some(p=>typeof p.id!=='string'||typeof p.name!=='string')||new Set(result.places.map(p=>p.id)).size!==result.places.length)throw Error('INVALID_QLOO_RESULT');
  record('qloo',{action:'recommend_places',resultCount:result.places.length});
  if(!result.places.length)return {status:'empty',places:[],trace,source:'Qloo API + browser-local Qwen',inventedTimes:false};
  const max=Math.min(6,days*2,result.places.length),ids=result.places.map(p=>p.id);
  const schema={type:'object',additionalProperties:false,required:['action','selected_ids'],properties:{action:{type:'string',enum:['select_places']},selected_ids:{type:'array',minItems:1,maxItems:max,items:{type:'string',enum:ids}}}};
  // Provider descriptions are untrusted data, never instructions. Only existing IDs
  // may be selected; prose, times, prices and arbitrary tool arguments are rejected.
  const selection=await decide({goal,stage:'select',schema,places:result.places.map(p=>({id:p.id,name:p.name,description:p.description?.slice(0,350),address:p.address?.slice(0,160)})),signal});
  if(signal?.aborted)throw Error('CANCELLED');
  if(!object(selection,['action','selected_ids'])||selection.action!=='select_places'||!Array.isArray(selection.selected_ids)||!selection.selected_ids.length||selection.selected_ids.length>max||new Set(selection.selected_ids).size!==selection.selected_ids.length||selection.selected_ids.some(id=>!ids.includes(id)))throw Error('INVALID_MODEL_SELECTION');
  record('model',{action:'select_places',selectedIds:selection.selected_ids});
  return {status:'ok',places:selection.selected_ids.map(id=>structuredClone(result.places.find(p=>p.id===id))),trace,source:'Qloo API + browser-local Qwen',inventedTimes:false};
}
