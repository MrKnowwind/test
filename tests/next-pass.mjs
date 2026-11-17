import {spawn} from 'node:child_process';
const steps=[['tests/district-browser.mjs','--final'],['tests/search-browser.mjs'],['tests/procedural-browser.mjs','http://127.0.0.1:4173/','--final'],['tests/final-flow-browser.mjs']];
for(const args of steps) await new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,args,{stdio:'inherit'});
 child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(args[0]+' exited '+code)));
});
