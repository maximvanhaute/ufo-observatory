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

export function populationPeriod(reports, population, year) {
  if (year !== 'all') return {isAverage:false, startYear:year, endYear:year, yearCount:1, label:String(year)};
  let first = Infinity, last = -Infinity;
  for (const report of reports) {
    if (!report.eligible_for_time_analysis) continue;
    first = Math.min(first, report.year);
    last = Math.max(last, report.year);
  }
  const latestPopulationYear = population.metadata?.max_year ?? Math.max(...population.records.map(row => row.year));
  const startYear = Number.isFinite(first) ? first : latestPopulationYear;
  const endYear = Math.min(Number.isFinite(last) ? last : latestPopulationYear, latestPopulationYear);
  return {isAverage:true, startYear, endYear, yearCount:Math.max(0, endYear - startYear + 1), label:startYear + '–' + endYear};
}

export function comparePopulation(reports, population, states, filters, year) {
  const period = populationPeriod(reports, population, year);
  const candidates = filterReports(reports, {
    ...filters, state:'', from:String(period.startYear), to:String(period.endYear),
  });
  const denominators = new Map();
  const coverage = new Map();
  for (const row of population.records) {
    if (row.year < period.startYear || row.year > period.endYear) continue;
    denominators.set(row.state_code + ':' + row.year, row.population);
    if (!coverage.has(row.state_code)) coverage.set(row.state_code, {personYears:0, years:[]});
    const item = coverage.get(row.state_code);
    item.personYears += row.population;
    item.years.push(row.year);
  }
  const counts = new Map(), matchedCounts = new Map();
  for (const report of candidates) {
    counts.set(report.state_code, (counts.get(report.state_code) || 0) + 1);
    if (denominators.has(report.state_code + ':' + report.year)) {
      matchedCounts.set(report.state_code, (matchedCounts.get(report.state_code) || 0) + 1);
    }
  }
  const allStates = states.map(state => {
    const item = coverage.get(state.state_code);
    const years = item?.years.length || 0;
    const totalReports = counts.get(state.state_code) || 0;
    const count = years ? matchedCounts.get(state.state_code) || 0 : totalReports;
    const personYears = item?.personYears || 0;
    return {
      code:state.state_code, name:state.state_name, year, period:period.label,
      isAverage:period.isAverage, totalReports, count,
      coveredYears:years, personYears,
      coverageStart:years ? Math.min(...item.years) : null,
      coverageEnd:years ? Math.max(...item.years) : null,
      population:years ? personYears / years : null,
      annualCount:years ? count / years : null,
      rate:personYears ? count * 100000 / personYears : null,
    };
  });
  const rows = allStates.filter(row => row.population !== null);
  const matchedReports = rows.reduce((sum, row) => sum + row.count, 0);
  const residents = rows.reduce((sum, row) => sum + row.population, 0);
  const residentYears = rows.reduce((sum, row) => sum + row.personYears, 0);
  const displayedCount = row => period.isAverage ? row.annualCount : row.count;
  const byCount = [...rows].sort((a, b) => displayedCount(b) - displayedCount(a) || a.name.localeCompare(b.name));
  const byRate = [...rows].sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  let outsidePeriodReports = 0;
  if (period.isAverage) {
    outsidePeriodReports = filterReports(reports, {...filters, state:'', from:'', to:''})
      .filter(row => row.eligible_for_time_analysis && (row.year < period.startYear || row.year > period.endYear)).length;
  }
  return {
    year, ...period, rows, allStates, byCount, byRate, matchedReports,
    totalReports:candidates.length,
    excludedReports:candidates.length - matchedReports,
    outsidePeriodReports,
    missingStates:allStates.filter(row => row.population === null),
    partialStates:rows.filter(row => row.coveredYears < period.yearCount),
    residents, residentYears,
    weightedRate:residentYears ? matchedReports * 100000 / residentYears : null,
  };
}

export function populationToCsv(comparison) {
  const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  let columns = ['state_code', 'state_name', 'occurrence_year', 'reports', 'population', 'reports_per_100000', 'population_status'];
  let rows = comparison.allStates.map(row => [
    row.code, row.name, row.year, row.count, row.population,
    row.rate === null ? '' : row.rate.toFixed(6),
    row.population === null ? 'unavailable' : 'matched',
  ]);
  if (comparison.isAverage) {
    columns = ['state_code', 'state_name', 'period_start_year', 'period_end_year', 'population_years_covered',
      'coverage_start_year', 'coverage_end_year', 'reports_compared', 'state_reports_in_period',
      'average_annual_reports', 'summed_annual_populations', 'average_population',
      'annual_reports_per_100000', 'population_status'];
    rows = comparison.allStates.map(row => [
      row.code, row.name, comparison.startYear, comparison.endYear, row.coveredYears,
      row.coverageStart, row.coverageEnd, row.population === null ? '' : row.count, row.totalReports,
      row.annualCount === null ? '' : row.annualCount.toFixed(6),
      row.personYears || '', row.population === null ? '' : row.population.toFixed(6),
      row.rate === null ? '' : row.rate.toFixed(6),
      row.population === null ? 'unavailable' : row.coveredYears < comparison.yearCount ? 'partial_year_coverage' : 'matched',
    ]);
  }
  return '\uFEFF' + [columns.join(','), ...rows.map(row => row.map(cell).join(','))].join('\r\n');
}
