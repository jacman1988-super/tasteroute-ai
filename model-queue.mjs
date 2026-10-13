// Cancelled results are discarded. A submitted GPU completion may still finish;
// do not interrupt an idle engine or start overlapping completions.
export function createDecisionQueue(decide){let tail=Promise.resolve();return context=>{const next=tail.then(async()=>{if(context.signal?.aborted)throw Error('CANCELLED');const value=await decide(context);if(context.signal?.aborted)throw Error('CANCELLED');return value;});tail=next.catch(()=>{});return next;};}
