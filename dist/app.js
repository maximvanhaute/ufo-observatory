import {DEFAULT_FILTERS, MONTHS, filterReports, aggregateReports, sortReports, reportsToCsv} from './data-engine.js';
import {escapeHtml as e, icon, shapeIcon, number, hydrateIcons, hideTooltip} from './ui.js';
import {renderStateMap, renderHourly, renderShapeBars, renderHeatmap, renderTimeline, renderCountryBars} from './charts.js';
import {reportCard, reportDetail, aboutContent} from './content.js';
import {loadReportPartitions} from './data-loader.js';
import {initSoundControls} from './sound.js';
import {comparePopulation, populationYearFromParam, populationReportFilters, populationToCsv, validatePopulation} from './population-engine.js';
import {renderPopulation} from './population-view.js';

const $ = id => document.getElementById(id);
const VIEWS=['explore','patterns','reports','about'];
const PAGE_SIZE=10;
let allReports=[],geometry,manifest,summaries,facts=[],filters={...DEFAULT_FILTERS},view='explore',page=1,sort='newest',filtered=[],stats,factIndex=0,currentReport=null;
let toastTimer,searchTimer,resizeTimer,filterReturnFocus;
let population, populationComparison, patternsTab='time', populationYear='all', populationMode='rate';

function showToast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2700);}
function populateSelect(element,items,allLabel){element.innerHTML=`<option value="">${e(allLabel)}</option>`+items.map(item=>`<option value="${e(item.value)}">${e(item.label)}</option>`).join('');}

function initControls(){
  const globalStats=aggregateReports(allReports);
  populateSelect($('population-year'), [{value:'all',label:'All years · annual average'}, ...[...manifest.years].reverse().map(year=>({value:year,label:year}))], 'Choose a period');
  $('population-year').options[0].disabled=true;
  for (const button of document.querySelectorAll('[data-pattern-tab]')) {
    button.addEventListener('click', () => {
      patternsTab=button.dataset.patternTab;
      if (patternsTab==='population') selectPopulationYear(populationYear);
      else {writeUrl(true);render();}
    });
  }
  $('population-year').addEventListener('change', event=>selectPopulationYear(event.target.value==='all'?'all':Number(event.target.value)));
  for (const button of document.querySelectorAll('[data-population-mode]')) {
    button.addEventListener('click', () => {populationMode=button.dataset.populationMode;writeUrl();renderCharts();});
  }
  $('population-read-reports').addEventListener('click', ()=>{filters=populationReportFilters(filters,populationYear);navigate('reports');});
  populateSelect($('country-filter'),globalStats.countries.map(c=>({value:c.key,label:`${c.name} (${number(c.count)})`})),'All countries / areas');
  populateSelect($('state-filter'),[...manifest.us_states].sort((a,b)=>a.state_name.localeCompare(b.state_name)).map(s=>({value:s.state_code,label:s.state_name})),'All US states');
  populateSelect($('from-filter'),manifest.years.map(y=>({value:y,label:y})),'Any');
  populateSelect($('to-filter'),manifest.years.map(y=>({value:y,label:y})),'Any');
  populateSelect($('shape-filter'),[...manifest.shapes].sort((a,b)=>a.shape_name.localeCompare(b.shape_name)).map(s=>({value:s.shape_key,label:s.shape_name})),'All shapes');
  $('shape-chips').innerHTML=['triangle','disk','orb','light','circle','rectangle'].map(key=>`<button class="shape-chip" data-shape="${key}" aria-pressed="false">${shapeIcon(key)}${key[0].toUpperCase()+key.slice(1)}</button>`).join('');
  const timeFields=document.createElement('details');timeFields.className='time-details';
  timeFields.innerHTML=`<summary>Month & local hour <span aria-hidden="true">+</span></summary><label class="field">Month<select id="month-filter"><option value="">Any month</option>${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></label><label class="field">Local hour<select id="hour-filter"><option value="">Any hour</option>${Array.from({length:24},(_,h)=>`<option value="${h}">${String(h).padStart(2,'0')}:00 – ${String(h).padStart(2,'0')}:59</option>`).join('')}</select></label>`;
  $('media-filter').closest('label').before(timeFields);
  const mapping={'country-filter':'country','state-filter':'state','shape-filter':'shape','from-filter':'from','to-filter':'to','month-filter':'month','hour-filter':'hour','media-filter':'media'};
  for(const [id,key] of Object.entries(mapping))$(id).addEventListener('change',event=>setFilter(key,event.target.value));
  $('shape-chips').addEventListener('click',event=>{const button=event.target.closest('[data-shape]');if(button)toggleShape(button.dataset.shape);});
  for(const id of ['clear-filters','reset-sidebar'])$(id).addEventListener('click',()=>resetFilters());
  $('active-filters').addEventListener('click',event=>{const chip=event.target.closest('[data-clear]');if(chip)setFilter(chip.dataset.clear,'');});
  $('filter-results').addEventListener('click',()=>{if(view==='patterns'&&patternsTab==='population')filters=populationReportFilters(filters,populationYear);closeFilters();navigate('reports');});
  $('open-filters').addEventListener('click',openFilters);
  $('close-filters').addEventListener('click',closeFilters);
  $('filter-scrim').addEventListener('click',closeFilters);
  $('view-state-reports').addEventListener('click',()=>navigate('reports'));
  $('report-search').addEventListener('input',event=>{const value=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>setFilter('query',value),160);});
  $('report-sort').addEventListener('change',event=>{sort=event.target.value;page=1;renderReports();});
  $('previous-page').addEventListener('click',()=>{page=Math.max(1,page-1);renderReports();$('report-tools')?.scrollIntoView({block:'start'});$('report-count-label').scrollIntoView({block:'center',behavior:'smooth'});});
  $('next-page').addEventListener('click',()=>{page++;renderReports();$('report-count-label').scrollIntoView({block:'center',behavior:'smooth'});});
  $('report-grid').addEventListener('click',event=>{const button=event.target.closest('[data-report]');if(button)openReport(button.dataset.report);});
  $('report-detail').addEventListener('click',event=>{if(event.target.closest('[data-action="close-report"]'))$('report-dialog').close();});
  $('report-dialog').addEventListener('click',event=>{if(event.target===$('report-dialog'))$('report-dialog').close();});
  $('report-dialog').addEventListener('close',()=>{currentReport=null;writeUrl();});
  $('fact-prev').addEventListener('click',()=>{factIndex=(factIndex-1+facts.length)%facts.length;renderFact();});
  $('fact-next').addEventListener('click',()=>{factIndex=(factIndex+1)%facts.length;renderFact();});
  for (const id of ['fact-prev', 'fact-next']) $(id).disabled = facts.length < 2;
  $('export-csv').addEventListener('click',exportCsv);
  $('share-view').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);showToast('Link copied — your filters are included.');}catch{showToast('Your filters are in the address bar. Copy that link to share.');}});
  document.addEventListener('click',event=>{const link=event.target.closest('a[data-view],button[data-view]');if(!link)return;event.preventDefault();navigate(link.dataset.view);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hideTooltip();if($('filters').classList.contains('is-open'))closeFilters();}
    if(event.key==='Tab'&&$('filters').classList.contains('is-open')){
      const focusable=[...$('filters').querySelectorAll('button:not([disabled]),select:not([disabled]),a[href],summary')].filter(el=>el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('popstate',()=>{readUrl();render();const report=new URLSearchParams(location.search).get('report');if(report)openReport(report,false);else if($('report-dialog').open)$('report-dialog').close();});
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(innerWidth>640&&$('filters').classList.contains('is-open'))closeFilters();renderCharts();},180);});
}

function readUrl(){
  const params=new URLSearchParams(location.search);
  view=VIEWS.includes(params.get('view'))?params.get('view'):'explore';
  filters={...DEFAULT_FILTERS};
  for(const key of Object.keys(filters))if(params.has(key))filters[key]=params.get(key);
  if(filters.country==='all')filters.country='';
  if(filters.country&&!manifest.countries.some(c=>c.country_key===filters.country))filters.country='US';
  if(filters.state&&!manifest.us_states.some(s=>s.state_code===filters.state))filters.state='';
  if(filters.state)filters.country='US';
  if(filters.shape&&!manifest.shapes.some(s=>s.shape_key===filters.shape))filters.shape='';
  for(const key of ['from','to'])if(filters[key]!==''&&!manifest.years.includes(Number(filters[key])))filters[key]='';
  for(const [key,min,max] of [['month',1,12],['hour',0,23]])if(filters[key]!==''&&(!Number.isInteger(Number(filters[key]))||Number(filters[key])<min||Number(filters[key])>max))filters[key]='';
  if(filters.from!==''&&filters.to!==''&&Number(filters.from)>Number(filters.to))[filters.from,filters.to]=[filters.to,filters.from];
  if(!['','yes','no','not_provided'].includes(filters.media))filters.media='';
  patternsTab=params.get('pattern')==='population'?'population':'time';
  populationMode=params.get('population_mode')==='count'?'count':'rate';
  populationYear=populationYearFromParam(params.get('population_year'),manifest.years);
}

function writeUrl(push=false){
  const params=new URLSearchParams();params.set('view',view);params.set('country',filters.country||'all');
  for(const [key,value] of Object.entries(filters))if(key!=='country'&&value!=='')params.set(key,value);
  if(patternsTab==='population'){
    params.set('pattern','population');params.set('population_year',populationYear);
    if(populationMode==='count')params.set('population_mode','count');
  }
  if(currentReport)params.set('report',currentReport);
  history[push?'pushState':'replaceState']({},'',`${location.pathname}?${params.toString()}`);
}

function setFilter(key,value){
  filters[key]=String(value);
  if(key==='country')filters.state='';
  if(key==='state'&&value)filters.country='US';
  if(key==='from'&&filters.to!==''&&value!==''&&Number(value)>Number(filters.to))filters.to=String(value);
  if(key==='to'&&filters.from!==''&&value!==''&&Number(value)<Number(filters.from))filters.from=String(value);
  page=1;writeUrl();render();
}
function toggleShape(key){setFilter('shape',filters.shape===key?'':key);}
function toggleHour(hour){setFilter('hour',filters.hour!==''&&Number(filters.hour)===hour?'':String(hour));}
function toggleCell(month,hour){const same=Number(filters.month)===month&&filters.hour!==''&&Number(filters.hour)===hour;filters.month=same?'':String(month);filters.hour=same?'':String(hour);page=1;writeUrl();render();}
function toggleYear(year){const same=Number(filters.from)===year&&Number(filters.to)===year;filters.from=same?'':String(year);filters.to=same?'':String(year);page=1;writeUrl();render();}
function resetFilters(){filters={...DEFAULT_FILTERS,country:''};if(view==='patterns'&&patternsTab==='population')populationYear='all';page=1;writeUrl();render();}
function navigate(next){if(!VIEWS.includes(next))return;closeFilters();view=next;page=1;writeUrl(true);render();window.scrollTo({top:0,behavior:'instant'});document.title=`UFO Observatory — ${next==='about'?'About the data':next[0].toUpperCase()+next.slice(1)}`;}

function selectPopulationYear(year){
  if(year!=='all'&&!manifest.years.includes(year))return;
  populationYear=year;page=1;writeUrl(true);render();
}
function selectPopulationState(code){
  setFilter('state',filters.state===code?'':code);
  if(filters.state)$('population-selected-title').focus({preventScroll:true});
}

function render(){
  const isPopulation=view==='patterns'&&patternsTab==='population';
  hideTooltip();filtered=filterReports(allReports,isPopulation?populationReportFilters(filters,populationYear):filters,{includeFlaggedDates:isPopulation});stats=aggregateReports(filtered);
  document.body.dataset.view=view;
  const headings={explore:['THE SIGHTING EXPLORER','Follow your curiosity.','What’s <span>out there?</span>','Explore the stories people report in our skies.'],patterns:['THE PATTERN LAB','Make the connections.','Strange skies.<span> Clear patterns.</span>','Explore when, where and how sightings are described.'],reports:['THE REPORT ROOM','Every report has a story.','Look closer.<span> Read the stories.</span>','Explore the original summaries behind the data.'],about:['BEHIND THE OBSERVATORY','Good questions. Careful data.','Stay curious.<span> Think critically.</span>','The sources, cleaning decisions and limits behind the visuals.']};
  if(isPopulation)headings.patterns=['THE POPULATION LAB','A different view of the same sky.','More people.<span> More sightings?</span>','Compare report counts with reports per 100,000 residents.'];
  $('metric-grid').hidden=isPopulation;
  $('pattern-time-panel').hidden=patternsTab!=='time';
  $('pattern-population-panel').hidden=patternsTab!=='population';
  $('occurrence-year-field').hidden=isPopulation;
  for(const button of document.querySelectorAll('[data-pattern-tab]'))button.setAttribute('aria-pressed',String(button.dataset.patternTab===patternsTab));
  $('population-year').value=String(populationYear);
  $('hero-title').innerHTML=headings[view][2];$('hero-subtitle').textContent=headings[view][3];$('section-eyebrow').textContent=headings[view][0];$('section-title').textContent=headings[view][1];
  for(const v of VIEWS)$('view-'+v).hidden=v!==view;
  document.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('workspace-layout').classList.toggle('about-layout',view==='about');$('filters').hidden=view==='about';
  $('open-filters').hidden=view==='about';$('export-csv').hidden=view==='about';
  syncControls();renderSelection();renderMetrics();renderCharts();
  if(view==='reports')renderReports();
  $('result-status').textContent=`${number(stats.total)} matching reports. ${number(stats.validTime)} have usable occurrence dates; ${number(stats.mapped)} are on the US state map.`;
}

function syncControls(){
  const mapping={'country-filter':'country','state-filter':'state','shape-filter':'shape','from-filter':'from','to-filter':'to','month-filter':'month','hour-filter':'hour','media-filter':'media'};
  for(const [id,key]of Object.entries(mapping))if($(id).value!==filters[key])$(id).value=filters[key];
  $('state-filter').disabled=Boolean(filters.country&&filters.country!=='US');
  $('shape-chips').querySelectorAll('[data-shape]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shape===filters.shape)));
  if($('report-search').value!==filters.query)$('report-search').value=filters.query;
  $('filter-result-count').textContent=number(stats.total);
  const active=Object.entries(filters).filter(([key,value])=>value!==''&&key!=='country').length+(filters.country&&filters.country!=='US'?1:0);
  $('mobile-filter-count').hidden=!active;$('mobile-filter-count').textContent=active;
}

function renderSelection(){
  const country=manifest.countries.find(c=>c.country_key===filters.country)?.country_name||'All countries / areas';
  const shape=manifest.shapes.find(s=>s.shape_key===filters.shape)?.shape_name||'all shapes';
  const year=view==='patterns'&&patternsTab==='population'?(populationYear==='all'?'all years':String(populationYear)):filters.from||filters.to?`${filters.from||'any year'} – ${filters.to||'any year'}`:'all years';
  $('selection-description').textContent=`${country} · ${year} · ${shape}`;
  const chips=[];
  if(filters.state)chips.push(['state',manifest.us_states.find(s=>s.state_code===filters.state)?.state_name||filters.state]);
  if(filters.month!=='')chips.push(['month',MONTHS[Number(filters.month)-1]]);
  if(filters.hour!=='')chips.push(['hour',`${String(filters.hour).padStart(2,'0')}:00 local`]);
  if(filters.media)chips.push(['media',filters.media==='yes'?'Media indicated':filters.media==='no'?'No media indicated by source':'Media not provided']);
  if(filters.query)chips.push(['query',`Search: ${filters.query}`]);
  $('active-filters').innerHTML=chips.map(([key,label])=>`<button class="active-chip" data-clear="${key}" aria-label="Clear ${e(label)} filter">${e(label)} <span aria-hidden="true">×</span></button>`).join('');
}

function renderMetrics(){
  $('metric-total').textContent=number(stats.total);$('metric-map').textContent=number(stats.mapped);$('metric-time').textContent=number(stats.validTime);
  $('metric-map-note').textContent=stats.usReports?`${number(stats.unmapped)} US ${stats.unmapped===1?'report':'reports'} outside the map`:'US states + Washington, DC';
  $('metric-time-note').textContent=stats.invalidTime?`${stats.invalidTime} missing or flagged ${stats.invalidTime===1?'date':'dates'}`:'all selected dates are usable';
  const shape=stats.shapes.find(s=>!['unknown','not_provided'].includes(s.key));
  $('metric-shape').textContent=shape?.name||'—';$('metric-shape-note').textContent=shape?`${number(shape.count)} of ${number(stats.total)} selected reports`:'no described shape in this selection';
}

function renderCharts(){
  if(!stats)return;
  if(view==='explore'){
    renderStateMap($('state-map'),geometry,stats,filters,code=>setFilter('state',filters.state===code?'':code),country=>setFilter('country',country));
    renderHourly($('explore-hourly'),stats,filters,toggleHour);
    renderShapeBars($('explore-shapes'),stats,filters,toggleShape,6,true);
    $('hourly-denominator').textContent=`Based on ${number(stats.validHours)} valid TimeOnly values${stats.invalidHours?`; ${number(stats.invalidHours)} missing or invalid times excluded`:''}. Valid clock times remain included when their calendar date is flagged.`;
    $('map-coverage').textContent=stats.usReports?`${number(stats.mapped)} of ${number(stats.usReports)} US reports mapped${stats.unmapped?` · ${stats.unmapped} outside map coverage`:''}. Counts are sample reports.`:'US map · select United States to explore state counts.';
  }else if(view==='patterns'){
    if(patternsTab==='population'){
      populationComparison=comparePopulation(allReports,population,manifest.us_states,filters,populationYear);
      renderPopulation(populationComparison,geometry,filters.state,populationMode,selectPopulationState);
      return;
    }
    renderHeatmap($('month-hour-heatmap'),stats,filters,toggleCell);
    renderShapeBars($('patterns-shapes'),stats,filters,toggleShape,10,false);
    renderTimeline($('timeline'),stats,toggleYear);
    renderCountryBars($('country-bars'),stats,key=>setFilter('country',filters.country===key?'':key));
    $('heatmap-denominator').textContent=`${number(stats.validTime)} usable occurrence dates · ${stats.invalidTime} excluded. Hours are local as recorded; they do not share one timezone.`;
  }
}

function renderReports(){
  const sorted=sortReports(filtered,sort),pages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));page=Math.min(page,pages);
  $('report-count-label').textContent=sorted.length?`${number(sorted.length)} matching ${sorted.length===1?'report':'reports'}`:'No matching reports';
  $('report-grid').innerHTML=sorted.length?sorted.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(reportCard).join(''):`<div class="empty-state"><img src="./assets/mascot.png" alt="" width="130" height="100"><h3>No sightings in this selection.</h3><p>Try a wider year range, another shape, or a different search.</p><button class="primary-button" id="empty-reset">Clear filters and explore</button></div>`;
  $('empty-reset')?.addEventListener('click',resetFilters);
  $('pagination').hidden=pages<=1;$('page-label').textContent=`Page ${page} of ${pages}`;$('previous-page').disabled=page===1;$('next-page').disabled=page===pages;
}

function openReport(id,push=true){const report=allReports.find(r=>r.report_id===id);if(!report)return;currentReport=id;$('report-detail').innerHTML=reportDetail(report);if(!$('report-dialog').open)$('report-dialog').showModal();if(push)writeUrl(true);}
function renderFact(){if(!facts.length){$('fact-banner').hidden=true;return;}const fact=facts[factIndex];$('fact-text').textContent=fact.text;$('fact-source').textContent=`${fact.title} ↗`;$('fact-source').href=fact.source_url;$('fact-position').textContent=`${factIndex+1} / ${facts.length}`;}

function openFilters(){
  filterReturnFocus=document.activeElement;$('filters').classList.add('is-open');$('filters').setAttribute('role','dialog');$('filters').setAttribute('aria-modal','true');$('filter-scrim').hidden=false;document.body.classList.add('filters-open');
  for(const id of ['main-content','site-header','hero','fact-banner','page-toolbar'])$(id).inert=true;
  document.querySelector('.mobile-nav').inert=true;
  $('close-filters').focus();
}
function closeFilters(){
  if(!$('filters')?.classList.contains('is-open'))return;
  $('filters').classList.remove('is-open');$('filters').removeAttribute('role');$('filters').removeAttribute('aria-modal');$('filter-scrim').hidden=true;document.body.classList.remove('filters-open');
  for(const id of ['main-content','site-header','hero','fact-banner','page-toolbar'])$(id).inert=false;
  document.querySelector('.mobile-nav').inert=false;
  if(filterReturnFocus?.isConnected)filterReturnFocus.focus();
}
function exportCsv(){
  const isPopulation=view==='patterns'&&patternsTab==='population';
  const csv=isPopulation?populationToCsv(populationComparison):reportsToCsv(filtered);
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=isPopulation?`ufo-population-${populationYear}.csv`:`ufo-observatory-${filters.country||'all'}-${filtered.length}-reports.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);showToast(isPopulation?'Exported state counts, populations, rates and coverage.':`Exported ${number(filtered.length)} matching reports.`);
}

async function load(){
  hydrateIcons();
  try{
    const files=['reports.json','us_states.geojson','manifest.json','summaries.json','fun_facts.json','population.json'];
    [allReports,geometry,manifest,summaries,facts,population]=await Promise.all(files.map(async name=>{const response=await fetch(new URL(`./data/${name}`,import.meta.url));if(!response.ok)throw new Error(`Could not load ${name} (${response.status}).`);return response.json();}));
    validatePopulation(population);
    allReports=await loadReportPartitions(allReports,async name=>{const response=await fetch(new URL(`./data/${name}`,import.meta.url));if(!response.ok)throw new Error(`Could not load ${name} (${response.status}).`);return response.json();});
    if(allReports.length!==manifest.total_reports||new Set(allReports.map(r=>r.report_id)).size!==allReports.length)throw new Error('The data files are inconsistent. Please restore a matching set of Fabric exports.');
    if(!window.d3)throw new Error('The map library could not be loaded. Please refresh the page.');
    $('sample-count').textContent=number(allReports.length);
    $('sample-period').textContent=`${manifest.years[0]} – ${manifest.years.at(-1)}`;
    $('about-content').innerHTML=aboutContent(manifest,summaries.quality);
    initControls();readUrl();renderFact();$('loading').hidden=true;$('workspace').hidden=false;render();
    const id=new URLSearchParams(location.search).get('report');if(id)openReport(id,false);
    document.documentElement.dataset.ready='true';
  }catch(error){console.error(error);$('loading').hidden=true;$('load-error').hidden=false;$('error-message').textContent=error.message;}
}
initSoundControls($('sound-toggle'));
load();
