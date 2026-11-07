import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT || process.argv[2] || 4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.m4a':'audio/mp4'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');const path=resolve(root,relative);if(!path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}if(!(await stat(path)).isFile())throw new Error('Not a file');const body=await readFile(path);const compressed=path.endsWith('.json.gz');res.writeHead(200,{'Content-Type':compressed?'application/json; charset=utf-8':types[extname(path)]||'application/octet-stream',...(compressed?{'Content-Encoding':'gzip'}:{}),'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}});
server.listen(port,'127.0.0.1',()=>console.log(`UFO Observatory ready: http://127.0.0.1:${port}`));
