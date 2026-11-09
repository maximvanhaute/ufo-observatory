import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DEFAULT_FILTERS,recordedDate} from '../dist/data-engine.js';
import {comparePopulation, validatePopulation, populationToCsv, populationYearFromParam, populationReportFilters} from '../dist/population-engine.js';
import {loadReportPartitions} from '../dist/data-loader.js';

const read = name => JSON.parse(readFileSync(new URL('../dist/data/' + name, import.meta.url), 'utf8'));
const population = read('population.json');
const manifest = read('manifest.json');
const reports = await loadReportPartitions(read('reports.json'), name => JSON.parse(gunzipSync(readFileSync(new URL('../dist/data/' + name, import.meta.url)))));
const compare = (filters = {}, year = 2024) => comparePopulation(reports, population, manifest.us_states, {...DEFAULT_FILTERS, ...filters}, year);

test('2024 rates use matching annual populations once per state', () => {
  validatePopulation(population);
  const result = compare();
  assert.equal(result.rows.length, 50);
  assert.equal(result.matchedReports, 3370);
  assert.equal(result.excludedReports, 16);
  const ca = result.rows.find(row => row.code === 'CA');
  const mt = result.rows.find(row => row.code === 'MT');
  assert.equal(ca.count, 334);
  assert.equal(ca.population, 39431263);
  assert.equal(ca.rate.toFixed(2), '0.85');
  assert.equal(mt.count, 35);
  assert.equal(mt.population, 1137233);
  assert.equal(mt.rate.toFixed(2), '3.08');
  assert.equal(result.byCount[0].code, 'CA');
  assert.equal(result.byRate[0].code, 'MT');
});

test('the selected state highlights a full comparison while report filters still apply', () => {
  assert.deepEqual(compare({state:'MT'}), compare());
  const filtered = compare({shape:'triangle', hour:'0', month:'1'});
  const expected = reports.filter(row => row.year === 2024 && row.shape_key === 'triangle' && row.hour === 0 && row.month === 1);
  assert.equal(filtered.totalReports, expected.length);
  const mt = filtered.rows.find(row => row.code === 'MT');
  assert.equal(mt.population, 1137233);
});

test('missing population stays unavailable and has no computed rate', () => {
  const result = compare();
  assert.equal(result.missingStates[0].code, 'AK');
  assert.equal(result.missingStates[0].population, null);
  assert.equal(result.missingStates[0].rate, null);
  assert.equal(result.rows.find(row => row.code === 'DC').population, 702250);
  const future = compare({}, 2025);
  assert.equal(future.rows.length, 0);
  assert.equal(future.weightedRate, null);
  assert.ok(future.totalReports > 0);
});

test('zero-report states retain denominators and a genuine zero rate', () => {
  const result = compare({query:'no-record-matches-this-exact-text-zzq'});
  assert.equal(result.matchedReports, 0);
  assert.equal(result.rows.length, 50);
  assert.ok(result.rows.every(row => row.count === 0 && row.rate === 0 && row.population > 0));
  assert.equal(result.residents, 339370855);
});

test('population CSV preserves unmatched states with blank denominators', () => {
  const csv = populationToCsv(compare());
  assert.ok(csv.includes('"MT","Montana","2024","35","1137233","3.077645","matched"'));
  assert.ok(csv.includes('"AK","Alaska","2024","15","","","unavailable"'));
  assert.equal(csv.split('\r\n').length, 52);
});

test('a duplicated state-year denominator is rejected', () => {
  assert.throws(() => validatePopulation({records:[population.records[0], population.records[0]]}), /duplicate/);
});

test('report population columns match the dimension without changing the report grain', () => {
  const lookup = new Map(population.records.map(row => [row.state_code + ':' + row.year, row.population]));
  assert.equal(new Set(reports.map(row => row.report_id)).size, 139872);
  for (const report of reports) {
    const expected = lookup.get(report.state_code + ':' + recordedDate(report).year) ?? null;
    assert.equal(report.state_population, expected);
  }
});

test('all-years rate averages annual rates equally over active matched years, as in SQL', () => {
  const states = [{state_code:'WA',state_name:'Washington'}, {state_code:'HI',state_name:'Hawaii'}];
  const samplePopulation = {metadata:{max_year:2002},records:[
    {state_code:'WA',year:2000,population:1000}, {state_code:'WA',year:2001,population:2000},
    {state_code:'WA',year:2002,population:3000}, {state_code:'HI',year:2001,population:100},
    {state_code:'HI',year:2002,population:200},
  ]};
  const sampleReports = [];
  for (const [state, year, count] of [['WA',2000,2], ['WA',2002,4], ['HI',2000,1], ['HI',2002,3]]) {
    for (let index=0;index<count;index++) sampleReports.push({
      state_code:state,country_key:'US',year,eligible_for_time_analysis:true,
    });
  }
  const result = comparePopulation(sampleReports, samplePopulation, states, DEFAULT_FILTERS, 'all');
  const wa = result.rows.find(row=>row.code==='WA');
  assert.equal(result.yearCount,3);
  assert.equal(wa.count,6);
  assert.equal(wa.annualCount,3);
  assert.equal(wa.population,2000);
  assert.equal(wa.personYears,4000);
  assert.equal(wa.activeYears,2);
  assert.equal(wa.coveredYears,3);
  assert.equal(wa.rate,(200+400/3)/2);
  const hi = result.rows.find(row=>row.code==='HI');
  assert.equal(hi.count,3);
  assert.equal(hi.totalReports,4);
  assert.equal(hi.coveredYears,2);
  assert.equal(hi.activeYears,1);
  assert.equal(hi.annualCount,3);
  assert.equal(hi.rate,1500);
  assert.equal(result.excludedReports,1);
});

test('all-years comparison retains every report in the denominator coverage reconciliation', () => {
  const result = compare({}, 'all');
  assert.equal(result.startYear,1905);
  assert.equal(result.endYear,2024);
  assert.equal(result.yearCount,120);
  assert.equal(result.totalReports,139872);
  assert.equal(result.matchedReports,135472);
  assert.equal(result.excludedReports,4400);
  assert.equal(result.outsidePeriodReports,3527);
  assert.equal(result.rows.length,50);
  assert.equal(result.partialStates.find(row=>row.code==='HI').coveredYears,75);
  assert.equal(result.missingStates[0].code,'AK');
  const wa = result.rows.find(row=>row.code==='WA');
  assert.equal(wa.count,7408);
  assert.equal(wa.activeYears,78);
  assert.equal(wa.rate.toFixed(2),'1.48');
  assert.equal(result.byCount[0].code,'CA');
  assert.equal(result.byCount[0].annualCount.toFixed(1),'191.4');
  assert.equal(result.byRate[0].code,'VT');
  assert.equal(result.byRate[0].rate.toFixed(2),'1.94');
});

test('all-years CSV describes annual means and the actual population coverage', () => {
  const csv = populationToCsv(compare({}, 'all'));
  assert.ok(csv.includes('active_years_count,active_start_year,active_end_year'));
  assert.ok(csv.includes('average_reports_per_active_year,average_population_active_years,average_annual_sightings_per_100k'));
  assert.ok(csv.includes('"HI","Hawaii","1905","2024","75"'));
  assert.ok(csv.includes('"partial_year_coverage"'));
  assert.equal(csv.split('\r\n').length,52);
});

test('every state average matches an independent raw-export reproduction of the group SQL',()=>{
  const expected=JSON.parse(readFileSync(new URL('../docs/feedback-reconciliation.json',import.meta.url),'utf8'));
  const comparison=compare({},'all');
  assert.equal(comparison.rows.length,expected.app_normalized_dc_join.states.length);
  for(const row of expected.app_normalized_dc_join.states){
    const actual=comparison.rows.find(r=>r.code===row.state_code);
    assert.equal(actual.count,row.reports);
    assert.equal(actual.activeYears,row.active_years);
    assert.ok(Math.abs(actual.rate-row.average_annual_sightings_per_100k)<1e-10,row.state_code+' rate');
    assert.ok(Math.abs(actual.annualCount-row.average_reports_per_active_year)<1e-10,row.state_code+' count');
    assert.ok(Math.abs(actual.population-row.average_population_active_years)<1e-7,row.state_code+' population');
  }
  assert.equal(comparison.matchedReports-expected.original_sql_join.matched_reports,157,'DC normalization explains the SQL join difference');
});

test('zero active years are unavailable, rather than a fabricated zero average',()=>{
  const comparison=compare({query:'no-record-matches-this-exact-text-zzq'},'all');
  assert.equal(comparison.rows.length,0);
  assert.equal(comparison.inactiveStates.length,50);
  assert.ok(comparison.allStates.every(row=>row.rate===null));
  assert.ok(populationToCsv(comparison).includes('"no_active_years"'));
});

test('population defaults to all years and its period does not mutate other page filters',()=>{
  for(const value of [null,'','all','invalid','1890'])assert.equal(populationYearFromParam(value,manifest.years),'all');
  assert.equal(populationYearFromParam('2024',manifest.years),2024);
  const filters={...DEFAULT_FILTERS,from:'2023',to:'2024',state:'MT'};
  assert.deepEqual(populationReportFilters(filters,'all'),{...filters,from:'',to:''});
  assert.deepEqual(populationReportFilters(filters,2024),{...filters,from:'2024',to:'2024'});
  assert.equal(filters.from,'2023');
  assert.equal(compare(filters,'all').matchedReports,135472,'hidden general year filters do not narrow the population comparison');
});
