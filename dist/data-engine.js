export const DEFAULT_FILTERS = Object.freeze({ country: 'US', state: '', shape: '', from: '', to: '', month: '', hour: '', media: '', query: '' });
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SHAPE_COLORS = { triangle: '#b9f56c', disk: '#55d7c9', orb: '#77b9fa', light: '#b5a4f4', circle: '#f0ce83', rectangle: '#f294b5', not_provided: '#8a9cac', unknown: '#b7c3d1' };
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filterReports(reports, filters) {
  const query = normalize(filters.query).trim();
  const usesTime = filters.from !== '' || filters.to !== '' || filters.month !== '' || filters.hour !== '';
  return reports.filter(r => {
    if (filters.country && r.country_key !== filters.country) return false;
    if (filters.state && r.state_code !== filters.state) return false;
    if (filters.shape && r.shape_key !== filters.shape) return false;
    if (usesTime && !r.eligible_for_time_analysis) return false;
    if (filters.from !== '' && r.year < Number(filters.from)) return false;
    if (filters.to !== '' && r.year > Number(filters.to)) return false;
    if (filters.month !== '' && r.month !== Number(filters.month)) return false;
    if (filters.hour !== '' && r.hour !== Number(filters.hour)) return false;
    if (filters.media && r.media_status !== filters.media) return false;
    if (query && !normalize([r.report_id, r.city, r.state_name, r.country_name, r.shape_name, r.summary].join(' ')).includes(query)) return false;
    return true;
  });
}

export function aggregateReports(reports) {
  const states = new Map(), shapeMap = new Map(), countryMap = new Map(), yearMap = new Map();
  const hours = Array.from({length: 24}, (_, hour) => ({hour, count: 0}));
  const heatmap = Array.from({length: 288}, (_, i) => ({month: Math.floor(i / 24) + 1, hour: i % 24, count: 0}));
  let validTime = 0, mapped = 0, usReports = 0, mediaYes = 0;
  for (const r of reports) {
    if (r.country_iso2 === 'US') usReports++;
    if (r.eligible_for_us_state_map) { states.set(r.state_code, (states.get(r.state_code) || 0) + 1); mapped++; }
    if (!shapeMap.has(r.shape_key)) shapeMap.set(r.shape_key, {key: r.shape_key, name: r.shape_name, count: 0});
    shapeMap.get(r.shape_key).count++;
    if (!countryMap.has(r.country_key)) countryMap.set(r.country_key, {key: r.country_key, name: r.country_name, count: 0});
    countryMap.get(r.country_key).count++;
    if (r.media_available === true) mediaYes++;
    if (r.eligible_for_time_analysis) {
      validTime++;
      yearMap.set(r.year, (yearMap.get(r.year) || 0) + 1);
      hours[r.hour].count++;
      heatmap[(r.month - 1) * 24 + r.hour].count++;
    }
  }
  const years = [...yearMap.keys()].sort((a,b) => a-b);
  const timeline = years.length ? Array.from({length: years.at(-1) - years[0] + 1}, (_, i) => ({year: years[0] + i, count: yearMap.get(years[0] + i) || 0})) : [];
  return { total: reports.length, validTime, invalidTime: reports.length - validTime, mapped, usReports, unmapped: usReports - mapped, mediaYes, states, hours, heatmap, timeline, shapes: [...shapeMap.values()].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name)), countries: [...countryMap.values()].sort((a,b) => b.count - a.count), years };
}

export function sortReports(reports, order = 'newest') {
  return [...reports].sort((a,b) => {
    if (!a.occurred_at_local && !b.occurred_at_local) return a.report_id.localeCompare(b.report_id);
    if (!a.occurred_at_local) return 1;
    if (!b.occurred_at_local) return -1;
    return (order === 'oldest' ? 1 : -1) * a.occurred_at_local.localeCompare(b.occurred_at_local) || a.report_id.localeCompare(b.report_id);
  });
}

export function formatOccurrence(record, withTime = false) {
  if (!record.occurred_at_local) return record.datetime_status === 'suspicious_year' ? 'Date flagged for review' : 'Date not provided';
  const [datePart, timePart] = record.occurred_at_local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const dateText = `${MONTHS[month - 1]} ${day}, ${year}`;
  if (!withTime) return dateText;
  const [hour, minute] = timePart.split(':').map(Number);
  return `${dateText} · ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function reportsToCsv(reports) {
  const columns = ['report_id','occurred_at_local','city','state_name','country_name','shape_name','summary','media_status','explanation_category','explanation_certainty','quality_flags','source_url'];
  const cell = value => { let v = Array.isArray(value) ? value.join('|') : String(value ?? ''); if (/^[=+@-]/.test(v)) v = "'" + v; return '"' + v.replaceAll('"', '""') + '"'; };
  return '\uFEFF' + [columns.join(','), ...reports.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n');
}
