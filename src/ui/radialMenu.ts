export const radialPageSize = 8;
const turn = Math.PI * 2;

export function radialIndex(x:number,y:number,count:number) {
  return (Math.round(Math.atan2(x,-y)/turn*count)+count)%count;
}

interface RadialOption {
  label: string;
  icon: HTMLElement;
  detail: string;
}

export function createRadialMenu(parent:HTMLElement,id:string) {
  const root=document.createElement('div');
  root.id=id;
  root.className='radial-menu';
  root.hidden=true;
  root.setAttribute('role','status');
  const ring=document.createElement('canvas');
  ring.className='radial-sectors';
  ring.width=ring.height=416;
  ring.setAttribute('aria-hidden','true');
  const context=ring.getContext('2d')!;
  const caption=document.createElement('div');
  caption.className='radial-caption';
  const heading=document.createElement('div');
  const secondary=document.createElement('small');
  caption.append(heading,secondary);
  const slots=document.createElement('div');
  slots.className='radial-options';
  root.append(ring,caption,slots);
  parent.append(root);

  return {
    setOpen(open:boolean) { root.hidden=!open; },
    render(options:readonly RadialOption[],selected:number,title:string,hint:string) {
      heading.textContent=title;
      secondary.textContent=hint;
      slots.replaceChildren();
      const center=ring.width/2;
      const outer=192,inner=107;
      const segment=turn/Math.max(1,options.length);
      context.clearRect(0,0,ring.width,ring.height);
      for(const [index,option] of options.entries()) {
        const angle=segment*index;
        const middle=angle-Math.PI/2;
        const start=middle-segment/2+.027,end=middle+segment/2-.027;
        const current=index===selected;
        context.beginPath();
        context.arc(center,center,outer,start,end);
        context.arc(center,center,inner,end,start,true);
        context.closePath();
        context.fillStyle=current?'#54756aee':'#172a2ddf';
        context.strokeStyle=current?'#fafdff':'#8ea89c6a';
        context.lineWidth=current?2.5:1;
        context.fill();context.stroke();
        if(current) {
          context.save();
          context.translate(center,center);
          context.rotate(angle);
          context.beginPath();
          context.moveTo(-8,-205);context.lineTo(8,-205);context.lineTo(0,-193);
          context.closePath();
          context.fillStyle='#fff';
          context.fill();
          context.restore();
        }
        const slot=document.createElement('span');
        slot.className='radial-option';
        slot.dataset.selected=String(current);
        slot.style.left=`${50+36*Math.sin(angle)}%`;
        slot.style.top=`${50-36*Math.cos(angle)}%`;
        slot.setAttribute('aria-label',option.label);
        const detail=document.createElement('small');
        detail.textContent=option.detail;
        slot.append(option.icon,detail);
        slots.append(slot);
      }
    },
  };
}
