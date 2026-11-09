import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {loadReportPartitions} from '../dist/data-loader.js';
import {DEFAULT_FILTERS,filterReports,aggregateReports,sortReports,formatOccurrence,reportsToCsv,recordedHour} from '../dist/data-engine.js';
const read=name=>JSON.parse(readFileSync(new URL(`../dist/data/${name}`,import.meta.url),'utf8'));
const reports=await loadReportPartitions(read('reports.json'),name=>JSON.parse(gunzipSync(readFileSync(new URL(`../dist/data/${name}`,import.meta.url))))),quality=read('summaries.json').quality;

test('the app counts reconcile with the Fabric quality export',()=>{const a=aggregateReports(reports);assert.equal(a.total,quality.clean_reports);assert.equal(a.validTime,quality.valid_time_reports);assert.equal(a.mapped,quality.reports_mapped_to_us_states);assert.equal(a.usReports,quality.us_reports);assert.equal(a.validHours,quality.valid_hour_reports);assert.equal(a.hours.reduce((n,r)=>n+r.count,0),a.validHours);assert.equal(a.heatmap.length,288);assert.equal(a.heatmap.reduce((n,r)=>n+r.count,0),a.validTime);assert.equal(a.shapes.reduce((n,r)=>n+r.count,0),a.total);});
test('the default view shows all US reports and retains unmapped records',()=>{const a=aggregateReports(filterReports(reports,DEFAULT_FILTERS));assert.equal(a.total,139887);assert.equal(a.mapped,139671);assert.equal(a.unmapped,216);});
test('year, shape and state cross-filters agree with independent source selection',()=>{const f={...DEFAULT_FILTERS,state:'CA',shape:'triangle',from:'2023',to:'2023'};const actual=filterReports(reports,f);const expected=reports.filter(r=>r.country_key==='US'&&r.state_code==='CA'&&r.shape_key==='triangle'&&r.eligible_for_time_analysis&&r.year===2023);assert.deepEqual(actual,expected);});
test('midnight and January do not disappear as falsy filters',()=>{const result=filterReports(reports,{...DEFAULT_FILTERS,country:'',hour:'0',month:'1'});assert.ok(result.length>0);assert.ok(result.every(r=>r.hour===0&&r.month===1));});
test('historical reports count in the dashboard and CSV while the timeline starts in 1905',()=>{
  const historical=reports.filter(row=>row.year<1900);
  assert.equal(quality.pre_1900_reports_retained,15);
  assert.equal(historical.length,15);
  assert.ok(historical.every(row=>row.eligible_for_time_analysis&&row.quality_flags.includes('historical_date')));
  const first=filterReports(reports,{...DEFAULT_FILTERS,from:'1400',to:'1400'});
  assert.deepEqual(first.map(row=>row.report_id),['nuforc-54856']);
  assert.equal(formatOccurrence(first[0]),'Jun 30, 1400 (approximate)');
  const dashboard=aggregateReports(reports);
  assert.equal(dashboard.total,139887);
  assert.equal(dashboard.timeline[0].year,1905);
  assert.equal(dashboard.timeline.reduce((total,row)=>total+row.count,0),139872);
  assert.deepEqual(aggregateReports(first).timeline,[]);
  assert.ok(reportsToCsv(first).includes('1400-06-30T00:00:00'));
});
test('explicit No media is preserved separately from missing media',()=>{const noMedia=filterReports(reports,{...DEFAULT_FILTERS,country:'',media:'no'});assert.equal(noMedia.length,133051);assert.ok(noMedia.every(r=>r.media_available===false));assert.equal(filterReports(reports,{...DEFAULT_FILTERS,country:'',media:'yes'}).length,6836);assert.equal(filterReports(reports,{...DEFAULT_FILTERS,country:'',shape:'unknown'}).length,25853);});
test('search is case-insensitive and supports accents without changing the source',()=>{const f={...DEFAULT_FILTERS,country:'',query:'POUGHKEEPSIE'};assert.ok(filterReports(reports,f).some(r=>r.report_id==='nuforc-68697'));assert.equal(reports.find(r=>r.report_id==='nuforc-68697').city,'Poughkeepsie');});
test('date formatting preserves recorded local time without timezone conversion',()=>{assert.equal(formatOccurrence({occurred_at_local:'2023-07-04T00:30:00'},true),'Jul 4, 2023 · 12:30 AM');});
test('sort sends missing or flagged dates to the end in either direction',()=>{for(const order of ['oldest','newest']){const flagged={report_id:'flagged-fixture',occurred_at_local:null};const sorted=sortReports([...reports.slice(0,2),flagged],order);assert.equal(sorted.at(-1),flagged);}});
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

test('all 24 hourly buckets match TimeOnly SQL including historical reports',()=>{
  const expected=JSON.parse(readFileSync(new URL('../docs/feedback-reconciliation.json',import.meta.url),'utf8'));
  const result=aggregateReports(reports);
  assert.deepEqual(result.hours,expected.hours.map(({hour,count})=>({hour,count})));
  assert.equal(result.validHours,139887);
  assert.equal(result.validTime,139887);
  for(const hour of expected.hours){
    const selected=filterReports(reports,{...DEFAULT_FILTERS,hour:String(hour.hour)});
    assert.equal(selected.length,hour.count);
  }
});

test('invalid clock time does not enter the hourly chart and midnight remains valid',()=>{
  assert.equal(recordedHour({source_occurrence_time_raw:'00:00:00'}),0);
  for(const value of ['24:00:00','12:60:00','12:00:60','unknown','2026-01-01T12:00:00'])assert.equal(recordedHour({source_occurrence_time_raw:value}),null);
});
