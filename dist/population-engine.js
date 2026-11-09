import {filterReports, recordedDate} from './data-engine.js';

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

export function populationYearFromParam(value, years) {
  return value !== null && value !== '' && value !== 'all' && years.includes(Number(value)) ? Number(value) : 'all';
}

export function populationPeriod(reports, population, year) {
  if (year !== 'all') return {isAverage:false, startYear:year, endYear:year, yearCount:1, label:String(year)};
  const years = population.records.map(row => row.year);
  const endYear = population.metadata?.max_year ?? Math.max(...years);
  const firstReportYear = reports.reduce((first, report) => Math.min(first, recordedDate(report)?.year ?? Infinity), Infinity);
  const startYear = Math.max(population.metadata?.min_year ?? Math.min(...years), Math.min(firstReportYear, endYear));
  return {isAverage:true, startYear, endYear, yearCount:endYear - startYear + 1, label:startYear + '–' + endYear};
}

// Population selection is independent of the calendar filters on other pages.
export function populationReportFilters(filters, year) {
  return {...filters, from:year === 'all' ? '' : String(year), to:year === 'all' ? '' : String(year)};
}

export function comparePopulation(reports, population, states, filters, year) {
  const period = populationPeriod(reports, population, year);
  const candidates = filterReports(reports, {
    ...populationReportFilters(filters, year), state:'',
  }, {includeFlaggedDates:true}).filter(report => recordedDate(report) !== null);
  const denominators = new Map(), coverage = new Map();
  for (const row of population.records) {
    if (row.year < period.startYear || row.year > period.endYear) continue;
    denominators.set(row.state_code + ':' + row.year, row.population);
    if (!coverage.has(row.state_code)) coverage.set(row.state_code, []);
    coverage.get(row.state_code).push(row);
  }
  const counts = new Map(), yearlyCounts = new Map();
  let outsidePeriodReports = 0;
  for (const report of candidates) {
    const occurrenceYear = recordedDate(report).year;
    counts.set(report.state_code, (counts.get(report.state_code) || 0) + 1);
    const key = report.state_code + ':' + occurrenceYear;
    if (denominators.has(key)) yearlyCounts.set(key, (yearlyCounts.get(key) || 0) + 1);
    if (occurrenceYear > period.endYear) outsidePeriodReports++;
  }
  const allStates = states.map(state => {
    const covered = coverage.get(state.state_code) || [];
    const active = covered.filter(row => yearlyCounts.has(row.state_code + ':' + row.year));
    // Match AVG(Yearly_Rate_Per_100k) over the SQL's INNER JOIN: each active year
    // gets one equal weight; years with no sightings have no row in that query.
    const included = period.isAverage ? active : covered;
    const count = active.reduce((sum, row) => sum + yearlyCounts.get(row.state_code + ':' + row.year), 0);
    const personYears = included.reduce((sum, row) => sum + row.population, 0);
    const rateSum = active.reduce((sum, row) => sum + yearlyCounts.get(row.state_code + ':' + row.year) / row.population * 100000, 0);
    const totalReports = counts.get(state.state_code) || 0;
    return {
      code:state.state_code, name:state.state_name, year, period:period.label,
      isAverage:period.isAverage, totalReports, count:covered.length ? count : totalReports,
      populationAvailable:covered.length > 0,
      coveredYears:covered.length, activeYears:active.length, personYears,
      coverageStart:covered.length ? Math.min(...covered.map(row => row.year)) : null,
      coverageEnd:covered.length ? Math.max(...covered.map(row => row.year)) : null,
      activeStart:active.length ? Math.min(...active.map(row => row.year)) : null,
      activeEnd:active.length ? Math.max(...active.map(row => row.year)) : null,
      population:included.length ? personYears / included.length : null,
      annualCount:included.length ? count / included.length : null,
      rate:period.isAverage ? active.length ? rateSum / active.length : null : personYears ? count / personYears * 100000 : null,
    };
  });
  const rows = allStates.filter(row => row.rate !== null);
  const matchedReports = rows.reduce((sum, row) => sum + row.count, 0);
  const residents = rows.reduce((sum, row) => sum + row.population, 0);
  const residentYears = rows.reduce((sum, row) => sum + row.personYears, 0);
  const displayedCount = row => period.isAverage ? row.annualCount : row.count;
  const byCount = [...rows].sort((a, b) => displayedCount(b) - displayedCount(a) || a.name.localeCompare(b.name));
  const byRate = [...rows].sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
  return {
    year, ...period, rows, allStates, byCount, byRate, matchedReports,
    totalReports:candidates.length, excludedReports:candidates.length - matchedReports,
    outsidePeriodReports,
    missingStates:allStates.filter(row => !row.populationAvailable),
    inactiveStates:allStates.filter(row => row.populationAvailable && row.rate === null),
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
    columns = ['state_code', 'state_name', 'population_period_start_year', 'population_period_end_year',
      'population_years_covered', 'active_years_count', 'active_start_year', 'active_end_year',
      'reports_compared', 'state_reports_all_years', 'average_reports_per_active_year',
      'average_population_active_years', 'average_annual_sightings_per_100k', 'population_status'];
    rows = comparison.allStates.map(row => [
      row.code, row.name, comparison.startYear, comparison.endYear, row.coveredYears,
      row.activeYears, row.activeStart, row.activeEnd, row.populationAvailable ? row.count : '', row.totalReports,
      row.annualCount === null ? '' : row.annualCount.toFixed(6),
      row.population === null ? '' : row.population.toFixed(6), row.rate === null ? '' : row.rate.toFixed(6),
      !row.populationAvailable ? 'unavailable' : !row.activeYears ? 'no_active_years' : row.coveredYears < comparison.yearCount ? 'partial_year_coverage' : 'matched',
    ]);
  }
  return '\uFEFF' + [columns.join(','), ...rows.map(row => row.map(cell).join(','))].join('\r\n');
}
