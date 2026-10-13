import {createServer} from 'node:http';
import worker from './dist/server/index.js';
const env={QLOO_API_KEY:process.env.QLOO_API_KEY};
createServer(async(req,res)=>{try{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end();return;}chunks.push(chunk);}const response=await worker.fetch(new Request('http://127.0.0.1:8767'+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Request failed.');}}).listen(8767,'127.0.0.1',()=>console.log('TasteRoute: http://127.0.0.1:8767/'));
