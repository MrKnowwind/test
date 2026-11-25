/** Original program-drawn portrait of the port's supply automaton. */
export function renderMerchantPortrait(canvas:HTMLCanvasElement) {
  const c=canvas.getContext('2d')!;
  const background=c.createLinearGradient(0,0,300,210);
  background.addColorStop(0,'#355960');background.addColorStop(1,'#142832');
  c.fillStyle=background;c.fillRect(0,0,300,210);
  c.strokeStyle='#b1d4c31e';c.lineWidth=1;
  for(let x=-210;x<300;x+=34){c.beginPath();c.moveTo(x,210);c.lineTo(x+210,0);c.stroke();}
  function part(path:string,color:string,outline=true){
    const p=new Path2D(path);c.fillStyle=color;c.fill(p);
    if(outline){c.strokeStyle='#1b3440';c.lineWidth=2.5;c.lineJoin='round';c.stroke(p);}
  }
  part('M32 210V167L68 140 104 135H196L232 140 268 167V210Z','#365e70');
  part('M38 174L69 151 99 151 116 210H38Z M262 174L231 151 201 151 184 210H262Z','#b8d6d0');
  part('M113 133H187L192 163 173 183H127L108 163Z','#415968');
  part('M105 37L119 25H181L195 37 203 64V126L184 149H116L97 126V64Z','#c5d6cb');
  part('M98 67L86 73V116L98 124Z M202 67L214 73V116L202 124Z','#d88b59');
  part('M105 58L118 45H182L195 58V116L182 131H118L105 116Z','#557c82');
  part('M116 67L127 57H173L184 67V109L174 120H126L116 109Z','#1a3645');
  part('M124 74H176V102H124Z','#254f5a',false);
  part('M130 80H142V88H130Z M158 80H170V88H158Z','#b9f8df',false);
  part('M142 103Q150 110 158 103L154 108H146Z','#b9e9d5',false);
  part('M123 34H177L169 44H131Z','#edb777',false);
  part('M147 163H153V177H167V183H153V197H147V183H133V177H147Z','#d6f1df',false);
  part('M72 177H91L96 200H71Z','#e8ae77');
  c.fillStyle='#253d49';c.fillRect(76,182,13,4);c.fillRect(76,190,13,3);
  part('M195 33L209 20 214 24 202 43Z','#719a9a');
  c.fillStyle='#a8e7ca';c.beginPath();c.arc(210,23,5,0,Math.PI*2);c.fill();
}
