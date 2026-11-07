import {filterReports} from './data-engine.js';

export function validatePopulation(population) {
  const keys = new Set();
  for (const row of population.records) {
    const key = row.state_code + ':' + row.year;
    if (keys.has(key) || !Number.isInteger(row.year) || !Number.isFinite(row.population) || row.population <= 0) {
      throw new Error('The population file has an invalid or duplicate state-year.');
    }
    keys.add(key);
  }
}

export function comparePopulation(reports, population, states, filters, year) {
  const candidates = filterReports(reports, {
    ...filters, state: '', from: String(year), to: String(year),
  });
  const counts = new Map();
  for (const report of candidates) {
    counts.set(report.state_code, (counts.get(report.state_code) || 0) + 1);
  }
  const denominator = new Map(population.records
    .filter(row => row.year === year)
    .map(row => [row.state_code, row.population]));
  const allStates = states.map(state => ({
    code: state.state_code,
    name: state.state_name,
    year,
    count: counts.get(state.state_code) || 0,
    population: denominator.get(state.state_code) ?? null,
  }));
  for (const row of allStates) {
    row.rate = row.population === null ? null : row.count * 100000 / row.population;
  }
  const rows = allStates.filter(row => row.population !== null);
  const matchedReports = rows.reduce((sum, row) => sum + row.count, 0);
  const residents = rows.reduce((sum, row) => sum + row.population, 0);
  const byCount = [...rows].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const byRate = [...rows].sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  return {
    year, rows, allStates, byCount, byRate, matchedReports,
    totalReports: candidates.length,
    excludedReports: candidates.length - matchedReports,
    missingStates: allStates.filter(row => row.population === null),
    residents,
    weightedRate: residents ? matchedReports * 100000 / residents : null,
  };
}

export function populationToCsv(comparison) {
  const columns = ['state_code', 'state_name', 'occurrence_year', 'reports', 'population', 'reports_per_100000', 'population_status'];
  const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const rows = comparison.allStates.map(row => [
    row.code, row.name, row.year, row.count, row.population,
    row.rate === null ? '' : row.rate.toFixed(6),
    row.population === null ? 'unavailable' : 'matched',
  ]);
  return '\uFEFF' + [columns.join(','), ...rows.map(row => row.map(cell).join(','))].join('\r\n');
}
