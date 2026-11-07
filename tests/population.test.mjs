import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {DEFAULT_FILTERS} from '../dist/data-engine.js';
import {comparePopulation, validatePopulation, populationToCsv} from '../dist/population-engine.js';
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
  assert.equal(new Set(reports.map(row => row.report_id)).size, 139887);
  for (const report of reports) {
    const expected = report.eligible_for_time_analysis ? lookup.get(report.state_code + ':' + report.year) ?? null : null;
    assert.equal(report.state_population, expected);
  }
});

test('all-years rate weights annual populations and includes zero-report years', () => {
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
  assert.equal(wa.annualCount,2);
  assert.equal(wa.population,2000);
  assert.equal(wa.personYears,6000);
  assert.equal(wa.rate,100);
  const hi = result.rows.find(row=>row.code==='HI');
  assert.equal(hi.count,3);
  assert.equal(hi.totalReports,4);
  assert.equal(hi.coveredYears,2);
  assert.equal(hi.annualCount,1.5);
  assert.equal(hi.rate,1000);
  assert.equal(result.excludedReports,1);
});

test('all-years comparison retains partial coverage and excludes unsupported recent years', () => {
  const result = compare({}, 'all');
  assert.equal(result.startYear,1905);
  assert.equal(result.endYear,2024);
  assert.equal(result.yearCount,120);
  assert.equal(result.matchedReports,135472);
  assert.equal(result.outsidePeriodReports,3527);
  assert.equal(result.rows.length,50);
  assert.equal(result.partialStates[0].code,'HI');
  assert.equal(result.partialStates[0].coveredYears,75);
  assert.equal(result.missingStates[0].code,'AK');
  const wa = result.rows.find(row=>row.code==='WA');
  assert.equal(wa.count,7408);
  assert.equal(wa.rate.toFixed(2),'1.71');
  assert.equal(result.byCount[0].code,'CA');
  assert.equal(result.byCount[0].annualCount.toFixed(1),'138.8');
});

test('all-years CSV describes annual means and the actual population coverage', () => {
  const csv = populationToCsv(compare({}, 'all'));
  assert.ok(csv.includes('average_annual_reports,summed_annual_populations,average_population,annual_reports_per_100000'));
  assert.ok(csv.includes('"HI","Hawaii","1905","2024","75","1950","2024"'));
  assert.ok(csv.includes('"partial_year_coverage"'));
  assert.equal(csv.split('\r\n').length,52);
});
