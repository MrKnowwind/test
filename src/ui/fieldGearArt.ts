import type {ItemId} from '../raid/catalog.ts';

type Paint = (path:string, color:string, outline?:boolean)=>void;
export function drawFieldGear(id:ItemId,c:CanvasRenderingContext2D,paint:Paint) {
  const ink='#27394a', alloy='#a9c6c6', ice='#e1f2e5', teal='#49b4ab', brass='#e6a65a', plum='#9677bd', red='#f07869';
  const body=(path:string,color:string)=>paint(path,color,true);
  function line(points:string,color:string,width=2) {
    c.strokeStyle=color;c.lineWidth=width;c.stroke(new Path2D(points));
  }
  function disc(x:number,y:number,r:number,color:string) {
    c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fillStyle=color;c.fill();c.strokeStyle=ink;c.lineWidth=2;c.stroke();
  }
  function tilt(angle:number){c.translate(32,32);c.rotate(angle);c.translate(-32,-32);}
  function clasp(x:number,y:number){body('M'+x+' '+y+'h7v5h-7Z',brass);}
  switch(id) {
    case 'coil':
      tilt(-.28);body('M7 18h10v30H7zM47 16h10v33H47z',alloy);
      body('M15 21h34v24H15z','#9e543a');
      for(let x=17;x<49;x+=5){line('M'+x+' 20l-2 24',brass,3.5);}
      line('M48 43q6 10 12 4',brass,3);break;
    case 'seals':
      for(const [x,y,r] of [[24,27,15],[41,36,13],[24,45,9]]) {
        const d='M'+(x-r)+' '+y+'a'+r+' '+r+' 0 1 0 '+(2*r)+' 0a'+r+' '+r+' 0 1 0 '+(-2*r)+' 0';
        line(d,ink,7);line(d,'#729b93',3);
      }break;
    case 'valve':
      tilt(-.48);body('M5 26h12v-6h10v5h9v-6h8v7h13v12H44v7h-8v-6h-9v5H17v-6H5z',alloy);
      line('M20 23v17M39 22v20',brass,4);line('M48 29h8',ice);break;
    case 'turbine':
      disc(32,32,24,ink);
      for(let i=0;i<8;i++){c.save();c.translate(32,32);c.rotate(i*Math.PI/4);body('M0 -4Q-12 -14 -5 -24Q5 -25 12 -20Q1 -16 4 -5Z',alloy);c.restore();}
      disc(32,32,7,brass);break;
    case 'terminal':
      tilt(-.24);body('M4 23l7 -7h44l5 8v20l-6 5H9l-5 -5Z',teal);
      for(const x of [14,31,48]){disc(x,26,5,brass);line('M'+(x-2)+' 27l4 -3',ink);paint('M'+(x-4)+' 36h8v8h-8Z',ink);}break;
    case 'board': case 'core':
      tilt(-.2);body(id==='board'?'M6 16h42v5h9v25H34v5H6Z':'M12 14l7 -6h28l7 7v34l-8 7H19l-7 -8Z',id==='core'?plum:teal);
      for(const x of [16,24,32,40])line('M'+x+' 44v6',brass,4);
      body('M22 21h20v17H22Z',ink);paint('M26 24h12v10H26Z',id==='core'?red:alloy);
      line('M10 23h6l4 5M44 32h6v8',ice);disc(14,39,2,brass);break;
    case 'servo': case 'pump':
      tilt(-.22);body(id==='pump'?'M6 18h15l4 6 13 -3 4 -11h11v20l-6 4v15H15v-9H6Z':'M10 17l8 -7h24l10 9v31H15l-5 -6Z',id==='pump'?teal:plum);
      disc(33,34,15,alloy);disc(33,34,9,ink);disc(32,32,id==='pump'?5:4,id==='pump'?teal:brass);
      line('M13 49h38',ink,5);break;
    case 'sealbag':
      body('M19 8l10 3 9 -3 8 3 -6 10 9 11 5 18 -7 6H16l-6 -7 6 -18 9 -11Z','#a6b8a2');
      line('M22 21h20',ink,4);body('M36 21l9 3 -2 9 -8 -3Z',red);line('M16 47l7 -14',ice);break;
    case 'manual':
      tilt(-.16);body('M12 9h39v43l-5 5H12l-4 -5V14Z','#44848b');paint('M14 47h33v6H14Z',ice);line('M17 13v31',ink);
      line('M24 33l7 -13 9 13ZM28 35h10',brass,3);break;
    case 'lens':
      disc(32,32,25,brass);disc(32,32,20,ink);disc(32,32,16,'#5697b5');disc(32,32,10,'#53629c');line('M20 29q3 -11 14 -12',ice,4);break;
    case 'recorder':case 'calibration':
      tilt(-.12);body(id==='recorder'?'M4 23l6 -7h34l4 5h11v24l-6 6H10l-6 -5Z':'M14 13h29l8 9v28l-5 5H15l-5 -8V19Z',id==='recorder'?brass:alloy);
      body('M15 22h24v16H15Z',ink);line('M18 32l5 -5 5 4 7 -6',teal);
      if(id==='recorder'){disc(49,32,6,alloy);line('M15 44h22',ink,3);}else{disc(22,46,4,teal);disc(38,46,4,red);line('M30 13V6',alloy,4);}break;
    case 'tray':
      body('M4 32l13 -14h39l4 7 -13 21H9l-5 -5Z',alloy);body('M10 33l10 -10h31L42 38H12Z','#688792');line('M11 42h32l12 -16',ice);
      disc(28,29,4,ice);break;
    case 'spectrum':
      body('M5 23l10 -10h37l6 8v25l-8 7H12l-7 -7Z',ink);
      body('M11 24l8 -6h29l5 6 -7 6H13Z',alloy);for(const [x,col] of [[19,teal],[28,plum],[37,red]] as const)line('M'+x+' 35l-3 10',col,5);break;
    case 'archive':
      body('M11 8h37l7 7v40H10Z',plum);disc(32,32,19,alloy);disc(32,32,13,'#789eb6');disc(32,32,5,ink);
      paint('M32 14l11 4 -9 10Z',ice);body('M12 45h17v8H12Z',red);break;
    case 'rail':
      body('M5 43L47 8l12 1 -1 6 -6 1 -34 32 4 1 -6 7 -12 -2Z',alloy);line('M10 46l39 -33',ice,3);line('M16 46l37 -33',ink);break;
    case 'wrench':
      body('M6 47l28 -25q-1 -13 10 -16l-3 9 7 4 10 -8q3 18 -16 19L16 55q-8 4 -10 -8Z',alloy);line('M13 47l16 -14',brass,4);break;
    case 'gauge':
      body('M25 43h14v13H25Z',brass);disc(32,28,22,ink);disc(32,28,18,ice);
      line('M18 29l3 0M22 18l2 3M32 13v4M43 18l-3 3M46 29h-3',ink);line('M26 34l15 -14',red,3);disc(32,28,3,ink);break;
    case 'sling':case 'daypack':case 'repairpack':case 'tube':case 'school':case 'alpine':case 'longpack': {
      const styles={
        sling:['M7 30Q8 18 18 17h30l8 8 -3 20 -8 6H15L6 44Z',teal],
        daypack:['M13 27q1 -17 17 -19 18 -1 21 18l2 21 -8 8H21l-9 -7Z','#6a9fb3'],
        repairpack:['M5 28l7 -9h39l8 10 -2 18 -6 5H11l-6 -6Z',brass],
        tube:['M8 41L39 9q7 -4 14 2l5 7 -3 8 -30 30 -9 -1 -8 -7Z','#859c85'],
        school:['M13 21q2 -11 12 -12h14q12 2 13 15v26l-7 5H17l-6 -8Z',red],
        alpine:['M8 29h6l2 -14 7 -7h18l8 6 1 13 6 4v18l-8 6H15l-8 -8Z',plum],
        longpack:['M15 9l7 -5h16l6 6v10l8 2v15l-7 2v15l-7 5H21l-7 -6Z','#5e839d']
      } as const;
      const [outline,col]=styles[id];body(outline,col);
      if(id==='tube'){line('M15 35l17 16M34 16l17 16',ink,5);line('M18 34l17 16',brass);break;}
      if(id==='sling'){line('M13 23Q21 -1 44 15',ink,4);body('M9 27h44l-8 10H19Z',alloy);clasp(26,34);break;}
      if(id==='longpack'){line('M20 11v39',ice);line('M15 20h28M15 42h28',ink,5);clasp(29,40);break;}
      if(id==='repairpack'){line('M23 19v-6h18v6',ink,4);for(const x of [12,26,40])body('M'+x+' 30h11v14h-11Z','#9d6948');break;}
      body('M18 34h28v13l-4 3H20Z',col);line('M21 38h21',ice);
      if(id==='alpine'){body('M15 9l5 -4h25l4 6 -4 7H18Z',alloy);line('M21 17v16M41 17v16',ink,4);clasp(30,37);}
      else if(id==='school'){body('M14 20h36l-4 13H18Z','#c76058');clasp(29,29);}
      else line('M19 26q1 -13 15 -13',ice);break;
    }
  }
}
