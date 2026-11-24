// Run from a checkout with npm dependencies and Playwright Chromium installed.
// The optional argument is a second checkout to profile with the same camera and sampling code.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { chromium } from 'playwright';

const root=path.resolve(process.argv[2]??'.');
const outDir=await mkdtemp(path.join(tmpdir(),'saltport-frames-'));
const poses=[
  ['仓库',[-3.8,0,-3.7],Math.PI,false],
  ['街道',[29,0,89],-.69,false],
  ['交战特效',[-3,0,13],1.5,true],
];
const hook=`raidQA: {
  profile(feet,yaw,shoot,index){
    run.player.pose(feet,yaw,0);
    const begin=performance.now();step(1/60);const sim=performance.now()-begin;
    if(shoot && index%3===0){
      const eye=new THREE.Vector3(...run.player.eye),v=new THREE.Vector3(...run.player.direction);
      run.effects.fire({from:eye.clone().addScaledVector(v,.35).toArray(),to:eye.clone().addScaledVector(v,6).toArray(),surface:'infected'});
    }
    const gl=renderer.getContext(),out=new Uint8Array(4),start=performance.now();
    draw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,out);
    return [sim,performance.now()-start,renderer.info.render.calls,renderer.info.render.triangles];
  },`;
let browser;
try{
  await build({root,base:'./',logLevel:'error',build:{outDir},plugins:[{
    name:'saltport-frame-sample',enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/app/main.ts'))return;
      if(!code.includes('raidQA: {'))throw Error('找不到本地 QA 入口');
      return code.replace('raidQA: {',hook);
    },
  }]});
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});
  await page.route('http://127.0.0.1:4173/**',async route=>{
    const file=new URL(route.request().url()).pathname.slice(1)||'index.html';
    const contentType=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
    await route.fulfill({body:await readFile(path.join(outDir,file)),contentType});
  });
  await page.goto('http://127.0.0.1:4173/?qa=1&seed=42',{timeout:180000});
  await page.waitForFunction(()=>!!window.raidQA?.profile,null,{timeout:180000});
  for(const [name,feet,yaw,shoot] of poses){
    const rows=await page.evaluate(async ({feet,yaw,shoot})=>{
      const rows=[];
      for(let i=0;i<9;i++){
        const row=window.raidQA.profile(feet,yaw,shoot,i);
        if(i>=3)rows.push(row);
        await new Promise(requestAnimationFrame);
      }
      return rows;
    },{feet,yaw,shoot});
    const medians=rows[0].map((_,column)=>{
      const values=rows.map(row=>row[column]).sort((a,b)=>a-b);
      return (values[2]+values[3])/2;
    });
    console.log(JSON.stringify({name,simMs:medians[0],drawMs:medians[1],calls:medians[2],triangles:medians[3]}));
  }
}finally{await browser?.close();await rm(outDir,{recursive:true,force:true});}
