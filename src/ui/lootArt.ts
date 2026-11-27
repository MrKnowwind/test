import type { GoodsForm } from '../raid/catalog.ts';

type Shape = (path:string, color:string, outline?:boolean)=>void;

export function drawLootGoods(shape:Shape, id:string, {form,tint}:{form:GoodsForm;tint:string}) {
  const ink='#384e64', shadow='#708593', trim='#c6d8d5', light='#ebf4de', brass='#deae72';
  const variant=[...id].reduce((n,ch)=>(Math.imul(n,31)+ch.charCodeAt(0))>>>0,0);
  const accent=[brass,'#94d2b1','#de8b87','#97bfe3'][variant%4];
  switch(form) {
    case 'packet':
      shape('M13 10L52 7L58 15L54 52L48 57L10 54L7 47L9 18Z',tint,true);
      shape('M11 17L54 14L53 19L11 22ZM10 46L54 43L52 49L10 52Z',shadow);
      shape('M18 26L46 23V39L17 42Z',light,true);
      shape('M22 29L42 27V31L22 33ZM23 36L35 35V38L23 39Z',accent);
      break;
    case 'can':
      shape('M11 17Q32 8 54 17V47Q32 60 11 47Z',tint,true);
      shape('M12 25Q34 33 53 23V41Q34 49 12 42Z',accent);
      shape('M11 17Q32 5 54 17Q34 32 11 17Z',trim,true);
      shape('M27 15L39 13L43 17L34 21L25 19ZM22 35L38 33L44 37L36 42L26 40Z',ink);
      break;
    case 'part':
      shape('M9 27L17 11L39 7L54 17L57 38L46 53L22 57L8 45Z',shadow,true);
      shape('M12 21L21 9L39 7L54 17L52 36L45 46L22 50L10 39Z',tint,true);
      shape('M22 24L29 16L41 18L47 26L41 36L29 39L21 33Z',ink,true);
      shape('M26 25L32 21L41 22L43 27L38 32L29 32Z',trim);
      shape('M15 23L19 20L22 23L19 27ZM44 40L49 36L50 40L45 44Z',accent);
      break;
    case 'instrument':
      shape('M6 25L17 12L49 9L59 21V45L49 54L10 55L6 48Z',tint,true);
      shape('M13 26L53 21V42L47 48L14 50Z',ink,true);
      shape('M17 30L39 27V40L17 43Z',accent);
      shape('M20 33L25 32L28 37L33 30L37 30L37 33L34 33L28 40L24 35L20 36Z',light);
      shape('M43 28L49 27V33L43 34ZM43 38L49 37V42L43 43Z',trim);
      break;
    case 'folder':
      shape('M8 17L24 12L34 16L53 12L59 44L54 51L15 58Z',tint,true);
      shape('M13 20L21 18L51 15L54 44L19 51Z',light,true);
      shape('M20 25L43 20L44 24L21 29ZM22 33L47 27L48 31L23 37ZM25 41L37 38L38 42L26 45Z',shadow);
      shape('M42 40L51 38V46L43 48Z',accent,true);
      break;
    case 'case':
      shape('M22 16V10H44V17H39V14H27V19Z',ink,true);
      shape('M7 24L15 17L53 15L59 22V45L53 53L12 55L7 48Z',tint,true);
      shape('M8 29L56 24V32L8 38Z',ink);
      shape('M16 26L23 25V38L16 40ZM44 23L51 22V35L44 37Z',trim,true);
      shape('M28 39L39 38V47L28 49Z',accent);
      break;
    case 'vial':
      shape('M19 16L25 12L44 13L49 19L46 48L40 56L22 55L16 48Z',trim,true);
      shape('M20 28L30 30L46 25L43 46L38 51L24 50L20 46Z',tint,true);
      shape('M18 9L43 7L50 11V18L19 22L15 17Z',ink,true);
      shape('M24 34L32 33L34 39L28 43Z',accent);
      shape('M22 24L25 24L24 37L21 39Z',light);
      break;
    case 'optic':
      shape('M6 25L19 14L42 12L58 24L56 43L43 53L18 54L6 42Z',tint,true);
      shape('M27 25L36 18L49 18L59 25L57 43L48 50L34 48L26 40Z',ink,true);
      shape('M32 29L39 23L48 24L54 29L53 40L47 45L38 44L32 38Z',accent,true);
      shape('M36 30L42 26L48 28L38 33Z',light);
      shape('M12 29L21 27V39L12 41Z',shadow);
      break;
    case 'cloth':
      shape('M10 13L48 11L57 19L55 45L47 52L16 55L7 45Z',tint,true);
      shape('M10 37L54 34V43L46 48L16 50L10 44Z',shadow);
      shape('M23 13L33 14L34 48L25 50Z',accent,true);
      shape('M38 20L49 20V27L38 28Z',trim);
      break;
    case 'token':
      shape('M12 19L23 10L42 9L54 18L58 34L49 49L34 56L19 52L8 39Z',shadow,true);
      shape('M12 20L24 10L42 9L54 18L54 33L46 45L33 51L20 47L10 35Z',tint,true);
      shape('M18 24L25 17L40 15L48 22V34L41 42L32 46L21 40L16 32Z',ink,true);
      shape('M32 18L37 27L47 28L38 33L35 42L29 35L20 32L28 28Z',accent);
      shape('M24 21L31 19L29 23L23 25Z',light);
      break;
  }
  // Distinct maker seals on variants sharing a silhouette.
  const x=16+variant%7;
  shape(`M${x} 44l4 -1 1 3 -4 1Z`,accent);
}
