import {escapeHtml as e, number, bindMark, hideTooltip} from './ui.js';
import {renderStateMap} from './charts.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const rate = value => value.toFixed(2);
const mean = value => value.toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:1});
const displayedCount = row => row.isAverage ? row.annualCount : row.count;
const countText = row => row.isAverage ? mean(row.annualCount) : number(row.count);

function svgNode(tag, attributes = {}, text) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function describe(row) {
  if (row.isAverage) {
    return row.name + '\n' + number(row.count) + ' reports compared · ' + mean(row.annualCount) + ' per year' +
      '\n' + number(Math.round(row.population)) + ' average residents' +
      '\n' + rate(row.rate) + ' reports per 100,000 per year' +
      '\n' + row.coveredYears + ' covered years · ' + row.coverageStart + '–' + row.coverageEnd;
  }
  return row.name + '\n' + number(row.count) + ' reports in ' + row.year +
    '\n' + number(row.population) + ' residents\n' + rate(row.rate) + ' reports per 100,000';
}

function scatter(element, comparison, selectedState, onSelect) {
  element.replaceChildren();
  if (!comparison.rows.length) {
    element.innerHTML = '<p class="population-empty">Population is unavailable for this year. Choose a year through 2024.</p>';
    return;
  }
  const d3 = window.d3;
  const width = Math.max(320, element.clientWidth);
  const height = 330;
  const margin = {left: 52, right: 30, top: 25, bottom: 55};
  const maxPopulation = d3.max(comparison.rows, row => row.population);
  const maxCount = Math.max(d3.max(comparison.rows, displayedCount), maxPopulation * comparison.weightedRate / 100000, 1);
  const x = d3.scaleLinear().domain([0, maxPopulation * 1.05]).nice().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, maxCount * 1.08]).nice().range([height - margin.bottom, margin.top]);
  const svg = svgNode('svg', {viewBox: '0 0 ' + width + ' ' + height, class: 'population-scatter-svg', 'aria-label': comparison.isAverage ? 'Average state population versus average annual reports, ' + comparison.label : 'State population versus report count in ' + comparison.year});
  for (const tick of y.ticks(4)) {
    svg.append(svgNode('line', {x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick), class: 'chart-grid'}));
    svg.append(svgNode('text', {x: margin.left - 9, y: y(tick) + 4, 'text-anchor': 'end'}, number(tick)));
  }
  for (const tick of x.ticks(4)) {
    svg.append(svgNode('text', {x: x(tick), y: height - margin.bottom + 22, 'text-anchor': 'middle'}, (tick / 1000000).toLocaleString('en-US', {maximumFractionDigits: 1})));
  }
  svg.append(svgNode('line', {
    x1: x(0), y1: y(0), x2: x(maxPopulation),
    y2: y(maxPopulation * comparison.weightedRate / 100000), class: 'population-reference',
  }));
  svg.append(svgNode('text', {x: (margin.left + width - margin.right) / 2, y: height - 8, 'text-anchor': 'middle'}, comparison.isAverage ? 'Average population (millions)' : 'Population (millions)'));
  svg.append(svgNode('text', {transform: 'translate(14 ' + (height / 2) + ') rotate(-90)', 'text-anchor': 'middle'}, comparison.isAverage ? 'Average reports / year' : 'Reports in ' + comparison.year));

  const labelled = new Set([
    ...comparison.byCount.slice(0, 3).map(row => row.code),
    comparison.byRate[0]?.code,
    selectedState,
  ]);
  // Put the selected state last so its focus ring and marker remain visible.
  const rows = [...comparison.rows].sort((a, b) => Number(a.code === selectedState) - Number(b.code === selectedState));
  for (const row of rows) {
    const selected = row.code === selectedState;
    const dot = svgNode('circle', {
      cx: x(row.population), cy: y(displayedCount(row)), r: selected ? 7 : 5,
      class: 'population-dot' + (selected ? ' is-selected' : ''),
      'data-population-state': row.code, 'aria-pressed': String(selected),
    });
    bindMark(dot, {
      label: describe(row).replaceAll('\n', '. ') + '. Select state.',
      tooltip: describe(row), action: () => onSelect(row.code),
    });
    svg.append(dot);
    if (labelled.has(row.code)) {
      svg.append(svgNode('text', {x: x(row.population) + 8, y: y(displayedCount(row)) - 10, class: 'population-dot-label'}, row.code));
    }
  }
  element.append(svg);
}

function ranking(element, comparison, selectedState, mode, onSelect) {
  const rows = mode === 'count' ? comparison.byCount : comparison.byRate;
  const max = Math.max(...rows.map(row => mode === 'count' ? displayedCount(row) : row.rate), 1);
  const scrollTop = element.scrollTop;
  element.innerHTML = rows.length ? rows.map((row, index) => {
    const value = mode === 'count' ? displayedCount(row) : row.rate;
    return '<button class="population-rank-row" data-population-state="' + e(row.code) + '" aria-pressed="' + (row.code === selectedState) +
      '" aria-label="' + e(describe(row).replaceAll('\n', '. ')) + '">' +
      '<span class="population-rank-number">' + (index + 1) + '</span><span class="population-rank-name">' + e(row.name) +
      '</span><span class="population-rank-track" aria-hidden="true"><span style="width:' + (100 * value / max) +
      '%"></span></span><strong>' + (mode === 'count' ? countText(row) : rate(value)) + '</strong></button>';
  }).join('') : '<p class="population-empty">Choose a year with population data to compare states.</p>';
  for (const button of element.querySelectorAll('button')) {
    button.addEventListener('click', () => onSelect(button.dataset.populationState));
  }
  element.scrollTop = scrollTop;
}

export function renderPopulation(comparison, geometry, selectedState, mode, onSelect) {
  hideTooltip();
  $('population-period').textContent = comparison.isAverage ? 'All years · ' + comparison.label + ' · annual averages over covered years' :
    'Occurrence year ' + comparison.year + ' · matching population year';
  $('population-count').textContent = number(comparison.matchedReports);
  $('population-match-note').textContent = number(comparison.excludedReports) + ' reports outside population coverage';
  $('population-coverage').textContent = comparison.rows.length + ' / ' + comparison.allStates.length;
  const hasDC = comparison.rows.some(row => row.code === 'DC');
  $('population-coverage-caption').textContent = comparison.rows.length ?
    (comparison.rows.length - Number(hasDC)) + ' states' + (hasDC ? ' + DC' : '') : 'No populations for this year';
  $('population-volume-leader').textContent = comparison.matchedReports ? comparison.byCount[0].name : '—';
  $('population-volume-label').textContent = comparison.isAverage ? 'Highest annual average' : 'Most reports';
  $('population-volume-value').textContent = comparison.matchedReports ? countText(comparison.byCount[0]) + (comparison.isAverage ? ' reports / year' : ' reports') : 'no matching reports';
  $('population-rate-leader').textContent = comparison.matchedReports ? comparison.byRate[0].name : '—';
  $('population-rate-value').textContent = comparison.matchedReports ? rate(comparison.byRate[0].rate) + (comparison.isAverage ? ' per 100k / year' : ' per 100k') : 'no matching reports';
  $('population-rank-unit').textContent = mode === 'count' ? (comparison.isAverage ? 'Average annual reports over covered years' : 'Reports in ' + comparison.year) :
    comparison.isAverage ? 'Average annual reports per 100,000 residents' : 'Reports per 100,000 residents';
  for (const button of document.querySelectorAll('[data-population-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.populationMode === mode));
    button.textContent = button.dataset.populationMode === 'count' ? (comparison.isAverage ? 'Reports / year' : 'Total reports') :
      comparison.isAverage ? 'Per 100k / year' : 'Per 100k';
  }
  scatter($('population-scatter'), comparison, selectedState, onSelect);
  ranking($('population-ranking'), comparison, selectedState, mode, onSelect);

  const rowMap = new Map(comparison.rows.map(row => [row.code, row]));
  renderStateMap($('population-map'), geometry, {total: comparison.matchedReports, states: new Map(comparison.rows.map(row => [row.code, displayedCount(row)]))},
    {state: selectedState, country: 'US'}, onSelect, () => {}, {
      values: new Map(comparison.rows.map(row => [row.code, mode === 'count' ? displayedCount(row) : row.rate])),
      label: mode === 'count' ? (comparison.isAverage ? 'Map of average annual reports by state' : 'Map of report counts by state') :
        comparison.isAverage ? 'Map of average annual reports per 100,000 residents' : 'Map of reports per 100,000 residents',
      tooltip: code => rowMap.has(code) ? describe(rowMap.get(code)) : 'Population unavailable for this state in ' + comparison.label,
    });
  $('population-map-unit').textContent = mode === 'count' ? (comparison.isAverage ? 'Shading shows average annual reports' : 'Shading shows report counts') :
    comparison.isAverage ? 'Shading shows average annual reports per 100,000 residents' : 'Shading shows reports per 100,000 residents';
  const missing = comparison.missingStates.map(row => row.name).join(', ');
  const coverage = comparison.rows.length ? (missing ? 'Population unavailable for ' + missing + ' in ' + comparison.label + '. ' : '') :
    'Population is unavailable for ' + comparison.label + '. The supplied population file ends in 2024. ';
  const partial = comparison.partialStates.map(row => row.name + ' (' + row.coveredYears + ' of ' + comparison.yearCount + ' years, ' + row.coverageStart + '–' + row.coverageEnd + ')').join(', ');
  $('population-coverage-note').textContent = coverage +
    number(comparison.excludedReports) + ' reports excluded from this comparison. Gray states have no population match. ' +
    (comparison.isAverage ? number(comparison.outsidePeriodReports) + ' later reports are outside the population period. ' : '') +
    (partial ? 'Shorter coverage for ' + partial + '. ' : '') +
    'All states are compared; a selected state is highlighted. Shape, month, hour, media and search filters affect report counts.';
  $('population-insight').textContent = comparison.matchedReports ?
    comparison.byCount[0].name + (comparison.isAverage ? ' leads on annual average reports. ' : ' leads on volume. ') + comparison.byRate[0].name + ' leads per resident in this selection.' :
    'No reports match this selection. Try another year or clear your filters.';

  const selected = comparison.allStates.find(row => row.code === selectedState);
  $('population-selected').hidden = !selected;
  if (selected) {
    $('population-selected-title').textContent = selected.name + ' · ' + comparison.label;
    $('population-selected-values').textContent = comparison.isAverage ?
      number(selected.totalReports) + ' state reports in the period · ' +
      (selected.population === null ? 'population unavailable' :
        number(selected.count) + ' compared · ' + mean(selected.annualCount) + ' average reports / year · ' +
        number(Math.round(selected.population)) + ' average residents · ' + rate(selected.rate) + ' per 100,000 / year · ' +
        selected.coveredYears + ' covered years (' + selected.coverageStart + '–' + selected.coverageEnd + ')') :
      number(selected.count) + ' reports · ' + (selected.population === null ? 'population unavailable' : number(selected.population) + ' residents · ' + rate(selected.rate) + ' reports per 100,000');
  }
}
