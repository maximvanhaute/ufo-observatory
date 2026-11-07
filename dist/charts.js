import {MONTHS, SHAPE_COLORS} from './data-engine.js';
import {escapeHtml as e, shapeIcon, number, bindMark, hideTooltip} from './ui.js';
const NS = 'http://www.w3.org/2000/svg';
const node = (tag, attributes = {}, text) => {const n = document.createElementNS(NS, tag); for (const [key,value] of Object.entries(attributes)) n.setAttribute(key, value); if (text !== undefined) n.textContent = text; return n;};
const chartSize = (element, height) => ({width: Math.max(280, element.clientWidth - 26), height});
const clear = element => {element.replaceChildren(); hideTooltip();};
function empty(element, message) {element.innerHTML = `<div class="chart-empty">${e(message)}</div>`;}

export function renderStateMap(element, geometry, stats, filters, onState, onCountry, options = {}) {
  clear(element);
  const d3 = window.d3, W = 960, H = 555;
  const svg = node('svg', {viewBox:`0 0 ${W} ${H}`,class:'map-svg','aria-label':options.label || 'Interactive map of reports by US state'});
  const projection = d3.geoAlbersUsa().fitExtent([[28, 18], [W-28, H-25]], geometry);
  const path = d3.geoPath(projection), group = node('g');
  const values = options.values || stats.states;
  const max = Math.max(1,...values.values());
  const color = d3.interpolateRgb('#163347', '#b9f56c');
  for (const feature of geometry.features) {
    const count = stats.states.get(feature.id) || 0;
    const value = values.get(feature.id) || 0;
    const selected = filters.state === feature.id;
    const missing = Boolean(options.values) && !values.has(feature.id);
    const fill = filters.state ? (selected ? '#b9f56c' : '#102a3b') :
      missing ? '#34424e' : value ? color(Math.sqrt(value/max)) : '#102a3b';
    const tooltip = options.tooltip ? options.tooltip(feature.id) : `${feature.properties.state_name}\n${number(count)} ${count===1?'report':'reports'} in this selection\nClick to ${filters.state===feature.id?'clear':'explore'}`;
    const shape = node('path', {d:path(feature) || '',class:`state-path${missing ? ' population-missing' : ''}${selected ? ' is-selected' : ''}`,fill,'data-state':feature.id,'aria-pressed':String(selected)});
    bindMark(shape,{label:tooltip.replaceAll('\n','. ') + '. Select state.',tooltip,action:()=>onState(feature.id)});
    group.append(shape);
    const center = path.centroid(feature);
    if (path.area(feature) > 700 && center.every(Number.isFinite)) {
      const lightFill = filters.state ? selected : value > max*.3 && !missing;
      group.append(node('text',{x:center[0],y:center[1],fill: lightFill ? '#122a2d' : '#a2bdcb','font-size':'11','font-weight':'600','text-anchor':'middle','dominant-baseline':'middle','pointer-events':'none'},feature.id));
    }
  }
  svg.append(group); element.append(svg);
  const controls = document.createElement('div'); controls.className='map-zoom';
  controls.innerHTML='<button aria-label="Zoom in on map" data-zoom="in">+</button><button aria-label="Zoom out on map" data-zoom="out">−</button><button aria-label="Reset map zoom" data-zoom="reset" style="font-size:14px">↺</button>';
  let zoom = 1;
  controls.addEventListener('click', event => {const button=event.target.closest('[data-zoom]'); if (!button)return; zoom=button.dataset.zoom==='reset'?1:Math.max(1,Math.min(2.5,zoom+(button.dataset.zoom==='in'?.3:-.3))); group.setAttribute('transform',`translate(${W/2} ${H/2}) scale(${zoom}) translate(${-W/2} ${-H/2})`);});
  element.append(controls);
  if (filters.country && filters.country !== 'US') {
    const overlay = document.createElement('div'); overlay.className='map-empty-overlay';
    overlay.innerHTML='<h4>This map explores US states.</h4><p>Your charts and stories still reflect the selected country or area.</p><button class="primary-button">Explore the United States</button>';
    overlay.querySelector('button').addEventListener('click',()=>onCountry('US')); element.append(overlay);
  } else if (!stats.total && !options.values) {
    const overlay=document.createElement('div');overlay.className='map-empty-overlay';overlay.innerHTML='<h4>No reports match these filters.</h4><p>Try a wider year range or a different shape.</p>';element.append(overlay);
  }
}

export function renderHourly(element, stats, filters, onHour) {
  clear(element); if (!stats.validTime) {empty(element,'No usable occurrence times in this selection.');return;}
  const d3=window.d3,{width:W,height:H}=chartSize(element,170),m={left:34,right:6,top:9,bottom:30};
  const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart-svg','aria-label':'Reports by recorded local occurrence hour'});
  const x=d3.scaleBand().domain(stats.hours.map(d=>d.hour)).range([m.left,W-m.right]).padding(.25);
  const y=d3.scaleLinear().domain([0,Math.max(1,...stats.hours.map(d=>d.count))]).nice(3).range([H-m.bottom,m.top]);
  for(const tick of y.ticks(3)) {svg.append(node('line',{x1:m.left,x2:W-m.right,y1:y(tick),y2:y(tick),class:'chart-grid'}));svg.append(node('text',{x:m.left-7,y:y(tick)+3,'text-anchor':'end'},tick));}
  for(const item of stats.hours) {
    const rect=node('rect',{x:x(item.hour),y:y(item.count),width:x.bandwidth(),height:Math.max(item.count?2:1,y(0)-y(item.count)),rx:1.2,fill:filters.hour!==''&&Number(filters.hour)!==item.hour?'#3d665c':'#b9f56c',class:'chart-mark'});
    bindMark(rect,{label:`${item.hour}:00, ${item.count} reports. Filter by this hour.`,tooltip:`${String(item.hour).padStart(2,'0')}:00 local time\n${number(item.count)} reports`,action:()=>onHour(item.hour)});svg.append(rect);
    if(item.hour%3===0)svg.append(node('text',{x:x(item.hour)+x.bandwidth()/2,y:H-9,'text-anchor':'middle'},`${item.hour===0?'12a':item.hour<12?item.hour+'a':item.hour===12?'12p':item.hour-12+'p'}`));
  }
  element.append(svg);
}

export function renderShapeBars(element, stats, filters, onShape, limit=6, percentages=false) {
  clear(element);if(!stats.total){empty(element,'No shapes to show for this selection.');return;}
  const max=Math.max(...stats.shapes.map(d=>d.count));
  for(const shape of stats.shapes.slice(0,limit)){
    const button=document.createElement('button');button.className='bar-row';button.setAttribute('aria-pressed',String(filters.shape===shape.key));
    const percent=100*shape.count/stats.total;
    button.setAttribute('aria-label',`${shape.name}: ${number(shape.count)} reports, ${percent.toFixed(1)} percent. Filter by shape.`);
    button.title=`${number(shape.count)} of ${number(stats.total)} reports · ${percent.toFixed(1)}%`;
    button.innerHTML=`<span class="bar-name">${shapeIcon(shape.key)}<span>${e(shape.name)}</span></span><span class="bar-track"><span class="bar-fill" style="width:${100*shape.count/max}%;background:${SHAPE_COLORS[shape.key]||'#90b3c8'}"></span></span><span class="bar-value">${percentages?Math.round(percent)+'%':number(shape.count)}</span>`;
    button.addEventListener('click',()=>onShape(shape.key));element.append(button);
  }
}

export function renderHeatmap(element, stats, filters, onCell) {
  clear(element);if(!stats.validTime){empty(element,'No usable occurrence dates in this selection.');return;}
  const d3=window.d3,{width:W}=chartSize(element,290),H=290,left=31,right=5,top=6,bottom=60,cw=(W-left-right)/24,ch=(H-top-bottom)/12;
  const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart-svg','aria-label':'Month by recorded local hour heatmap; arrow keys move between cells, Enter filters'});
  const max=Math.max(1,...stats.heatmap.map(d=>d.count)),color=d3.interpolateRgb('#123347','#b9f56c');
  const rects=[];
  for(const cell of stats.heatmap){
    const selected=Number(filters.month)===cell.month && filters.hour!==''&&Number(filters.hour)===cell.hour;
    const rect=node('rect',{x:left+cell.hour*cw,y:top+(cell.month-1)*ch,width:cw-.3,height:ch-.3,rx:1.5,fill:cell.count?color(Math.sqrt(cell.count/max)):'#122938',class:`heatmap-cell${selected?' selected':''}`});
    bindMark(rect,{label:`${MONTHS[cell.month-1]}, ${cell.hour}:00, ${cell.count} reports.`,tooltip:`${MONTHS[cell.month-1]} · ${String(cell.hour).padStart(2,'0')}:00 local\n${number(cell.count)} reports\nClick to filter this month and hour`,tabIndex:rects.length===0?0:-1,action:()=>onCell(cell.month,cell.hour)});
    const index=rects.length;
    rect.addEventListener('keydown',event=>{const moves={ArrowRight:1,ArrowLeft:-1,ArrowDown:24,ArrowUp:-24};if(!(event.key in moves))return;event.preventDefault();const next=Math.max(0,Math.min(287,index+moves[event.key]));rects.forEach(r=>r.setAttribute('tabindex','-1'));rects[next].setAttribute('tabindex','0');rects[next].focus();});
    rects.push(rect);svg.append(rect);
  }
  MONTHS.forEach((month,i)=>svg.append(node('text',{x:left-6,y:top+i*ch+ch/2+3,'text-anchor':'end','font-size':'9'},month)));
  for(let hour=0;hour<24;hour+=3)svg.append(node('text',{x:left+hour*cw+cw/2,y:H-bottom+17,'text-anchor':'middle'},hour));
  svg.append(node('text',{x:left+(W-left)/2,y:H-bottom+34,'text-anchor':'middle'},'Recorded local hour'));
  const legendY=H-8,legendX=left+54,legendWidth=Math.min(150,W-150);
  svg.append(node('text',{x:left,y:legendY+3,'font-size':'9'},'Fewer'));
  for(let i=0;i<30;i++)svg.append(node('rect',{x:legendX+i*legendWidth/30,y:legendY-6,width:legendWidth/30+1,height:9,fill:color(i/29)}));
  svg.append(node('text',{x:legendX+legendWidth+8,y:legendY+3,'font-size':'9'},`More (${max})`));element.append(svg);
}

export function renderTimeline(element, stats, onYear) {
  clear(element);if(!stats.timeline.length){empty(element,'No usable occurrence dates in this selection.');return;}
  const d3=window.d3,{width:W}=chartSize(element,225),H=225,m={left:40,right:12,top:10,bottom:28};
  const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,class:'chart-svg','aria-label':'Reports in the sample by occurrence year'});
  const first=stats.timeline[0].year,last=stats.timeline.at(-1).year;
  const x=d3.scaleLinear().domain(first===last?[first-.5,last+.5]:[first,last]).range([m.left,W-m.right]);
  const y=d3.scaleLinear().domain([0,Math.max(...stats.timeline.map(d=>d.count),1)]).nice(4).range([H-m.bottom,m.top]);
  for(const tick of y.ticks(4)){svg.append(node('line',{x1:m.left,x2:W-m.right,y1:y(tick),y2:y(tick),class:'chart-grid'}));svg.append(node('text',{x:m.left-7,y:y(tick)+3,'text-anchor':'end'},tick));}
  const area=d3.area().x(d=>x(d.year)).y0(y(0)).y1(d=>y(d.count));
  const line=d3.line().x(d=>x(d.year)).y(d=>y(d.count));
  svg.append(node('path',{d:area(stats.timeline),fill:'#b9f56c15'}));svg.append(node('path',{d:line(stats.timeline),class:'timeline-line'}));
  for(const year of stats.timeline){const dot=node('circle',{cx:x(year.year),cy:y(year.count),r:3.2,class:'timeline-dot'});bindMark(dot,{label:`${year.year}: ${year.count} reports. Filter to year.`,tooltip:`${year.year}\n${number(year.count)} reports in this sample`,action:()=>onYear(year.year),tabIndex:year.count?0:-1});svg.append(dot);}
  const ticks=first===last?[first]:x.ticks(W<400?4:6).filter(Number.isInteger);
  ticks.forEach(tick=>svg.append(node('text',{x:x(tick),y:H-7,'text-anchor':'middle'},tick)));element.append(svg);
}

export function renderCountryBars(element, stats, onCountry) {
  clear(element);if(!stats.total){empty(element,'No places in this selection.');return;}
  const max=Math.max(...stats.countries.map(d=>d.count));
  for(const country of stats.countries.slice(0,8)){
    const row=document.createElement('button');row.className='bar-row country-bar';row.title=`${country.name}: ${country.count} reports`;
    row.innerHTML=`<span class="bar-name"><span>${e(country.name)}</span></span><span class="bar-track"><span class="bar-fill" style="width:${100*country.count/max}%;background:#55d7c9"></span></span><span class="bar-value">${number(country.count)}</span>`;
    row.setAttribute('aria-label',`${country.name}: ${country.count} reports. Filter by this place.`);row.addEventListener('click',()=>onCountry(country.key));element.append(row);
  }
}
