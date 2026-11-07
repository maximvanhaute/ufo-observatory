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
