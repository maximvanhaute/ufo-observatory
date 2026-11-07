import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadReportPartitions} from '../dist/data-loader.js';
import {DEFAULT_FILTERS,filterReports,aggregateReports,sortReports,formatOccurrence,reportsToCsv} from '../dist/data-engine.js';
const read=name=>JSON.parse(readFileSync(new URL(`../dist/data/${name}`,import.meta.url),'utf8'));
const reports=await loadReportPartitions(read('reports.json'),name=>JSON.parse(gunzipSync(readFileSync(new URL(`../dist/data/${name}`,import.meta.url))))),quality=read('summaries.json').quality;

test('the app counts reconcile with the Fabric quality export',()=>{const a=aggregateReports(reports);assert.equal(a.total,quality.clean_reports);assert.equal(a.validTime,quality.valid_time_reports);assert.equal(a.mapped,quality.reports_mapped_to_us_states);assert.equal(a.usReports,quality.us_reports);assert.equal(a.hours.reduce((n,r)=>n+r.count,0),a.validTime);assert.equal(a.heatmap.length,288);assert.equal(a.heatmap.reduce((n,r)=>n+r.count,0),a.validTime);assert.equal(a.shapes.reduce((n,r)=>n+r.count,0),a.total);});
test('the default view shows all US reports and retains unmapped records',()=>{const a=aggregateReports(filterReports(reports,DEFAULT_FILTERS));assert.equal(a.total,139887);assert.equal(a.mapped,139671);assert.equal(a.unmapped,216);});
test('year, shape and state cross-filters agree with independent source selection',()=>{const f={...DEFAULT_FILTERS,state:'CA',shape:'triangle',from:'2023',to:'2023'};const actual=filterReports(reports,f);const expected=reports.filter(r=>r.country_key==='US'&&r.state_code==='CA'&&r.shape_key==='triangle'&&r.eligible_for_time_analysis&&r.year===2023);assert.deepEqual(actual,expected);});
test('midnight and January do not disappear as falsy filters',()=>{const result=filterReports(reports,{...DEFAULT_FILTERS,country:'',hour:'0',month:'1'});assert.ok(result.length>0);assert.ok(result.every(r=>r.hour===0&&r.month===1));});
test('time filtering excludes flagged dates without losing them from the full sample',()=>{const r=reports.find(r=>r.datetime_status==='suspicious_year');assert.ok(r);assert.equal(quality.reports_excluded_from_time_charts,15);assert.ok(filterReports(reports,{...DEFAULT_FILTERS,country:''}).includes(r));assert.ok(!filterReports(reports,{...DEFAULT_FILTERS,country:'',from:'1900'}).includes(r));assert.equal(formatOccurrence(r),'Date flagged for review');});
test('explicit No media is preserved separately from missing media',()=>{const noMedia=filterReports(reports,{...DEFAULT_FILTERS,country:'',media:'no'});assert.equal(noMedia.length,133051);assert.ok(noMedia.every(r=>r.media_available===false));assert.equal(filterReports(reports,{...DEFAULT_FILTERS,country:'',media:'yes'}).length,6836);assert.equal(filterReports(reports,{...DEFAULT_FILTERS,country:'',shape:'unknown'}).length,25853);});
test('search is case-insensitive and supports accents without changing the source',()=>{const f={...DEFAULT_FILTERS,country:'',query:'POUGHKEEPSIE'};assert.ok(filterReports(reports,f).some(r=>r.report_id==='nuforc-68697'));assert.equal(reports.find(r=>r.report_id==='nuforc-68697').city,'Poughkeepsie');});
test('date formatting preserves recorded local time without timezone conversion',()=>{assert.equal(formatOccurrence({occurred_at_local:'2023-07-04T00:30:00'},true),'Jul 4, 2023 · 12:30 AM');});
test('sort sends missing or flagged dates to the end in either direction',()=>{for(const order of ['oldest','newest']){const sorted=sortReports(reports,order);assert.equal(sorted.at(-1).occurred_at_local,null);}});
test('CSV export preserves quotes and prevents spreadsheet formula execution',()=>{const csv=reportsToCsv([{report_id:'x',summary:'=SUM(1,2) "quoted"',quality_flags:['a','b']}]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('""quoted""'));assert.ok(csv.includes('a|b'));});

test('corrected dates and time-only values are preserved without synthetic dates',()=>{
  const r=reports.find(r=>r.report_id==='nuforc-196439');
  assert.equal(r.occurred_at_local,'2026-03-06T22:46:00');
  assert.equal(r.source_occurrence_date_raw,'03-06-2026');
  assert.equal(r.source_occurrence_time_raw,'22:46:00');
  assert.equal(r.source_url,'https://nuforc.org/sighting/?id=196439');
  assert.ok(reports.every(row=>/^\d{2}:\d{2}:\d{2}$/.test(row.source_occurrence_time_raw)));
});
test('partition loader rejects incomplete data',async()=>{await assert.rejects(loadReportPartitions({schema_version:'partitioned-v1',total_reports:2,parts:['one']},async()=>[{}]),/reconcile/);});
