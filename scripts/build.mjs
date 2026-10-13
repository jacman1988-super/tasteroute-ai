import {readFile,writeFile,mkdir} from 'node:fs/promises';import {build} from 'esbuild';import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);process.chdir(fileURLToPath(root));
const bundle=await build({entryPoints:['frontend.mjs'],bundle:true,write:false,format:'esm',platform:'browser',minify:true,legalComments:'eof'});
const assets={'/':{type:'text/html; charset=utf-8',body:await readFile('frontend.html','utf8')},'/style.css':{type:'text/css; charset=utf-8',body:await readFile('style.css','utf8')},'/app.js':{type:'text/javascript; charset=utf-8',body:bundle.outputFiles[0].text}};
const code=`import {createApi} from './api.mjs';\nconst assets=${JSON.stringify(assets)};\nconst api=createApi();\nexport default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);const asset=assets[url.pathname];if(request.method!=='GET'||!asset)return new Response('Not found',{status:404});return new Response(asset.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'}});}};\n`;
await writeFile('worker/index.js',code);
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
// Bundle the pure API into the Worker. Production artifact has one ESM entry.
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',minify:true});
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built public Worker and bundled browser AI. No credentials are packaged.');
