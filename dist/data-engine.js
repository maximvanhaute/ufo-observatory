export const DEFAULT_FILTERS = Object.freeze({ country: 'US', state: '', shape: '', from: '', to: '', month: '', hour: '', media: '', query: '' });
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SHAPE_COLORS = { triangle: '#b9f56c', disk: '#55d7c9', orb: '#77b9fa', light: '#b5a4f4', circle: '#f0ce83', rectangle: '#f294b5', not_provided: '#8a9cac', unknown: '#b7c3d1' };
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Clock-time analysis does not depend on the quality flag on the calendar date.
export function recordedHour(report) {
  if (report.source_occurrence_time_raw != null) {
    const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(report.source_occurrence_time_raw);
    return match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3]) < 60 ? Number(match[1]) : null;
  }
  return Number.isInteger(report.hour) && report.hour >= 0 && report.hour < 24 ? report.hour : null;
}

// The adapter validates Date_Fixed as MDY. Prefer its parsed calendar fields.
export function recordedDate(report) {
  if (report.eligible_for_time_analysis && Number.isInteger(report.year)) {
    return {year:report.year, month:report.month, day:report.day};
  }
  if (report.source_occurrence_date_raw == null) {
    return Number.isInteger(report.year) ? {year:report.year, month:report.month, day:report.day} : null;
  }
  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(report.source_occurrence_date_raw);
  if (!match) return null;
  const [, m, d, y] = match, month = Number(m), day = Number(d), year = Number(y);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] ? {year, month, day} : null;
}

export function filterReports(reports, filters, {includeFlaggedDates = false} = {}) {
  const query = normalize(filters.query).trim();
  const usesCalendar = filters.from !== '' || filters.to !== '' || filters.month !== '';
  return reports.filter(r => {
    if (filters.country && r.country_key !== filters.country) return false;
    if (filters.state && r.state_code !== filters.state) return false;
    if (filters.shape && r.shape_key !== filters.shape) return false;
    const date = includeFlaggedDates ? recordedDate(r) : r.eligible_for_time_analysis ? r : null;
    if (usesCalendar && !date) return false;
    if (filters.from !== '' && date.year < Number(filters.from)) return false;
    if (filters.to !== '' && date.year > Number(filters.to)) return false;
    if (filters.month !== '' && date.month !== Number(filters.month)) return false;
    if (filters.hour !== '' && recordedHour(r) !== Number(filters.hour)) return false;
    if (filters.media && r.media_status !== filters.media) return false;
    if (query && !normalize([r.report_id, r.city, r.state_name, r.country_name, r.shape_name, r.summary].join(' ')).includes(query)) return false;
    return true;
  });
}

export function aggregateReports(reports) {
  const states = new Map(), shapeMap = new Map(), countryMap = new Map(), yearMap = new Map();
  const hours = Array.from({length: 24}, (_, hour) => ({hour, count: 0}));
  const heatmap = Array.from({length: 288}, (_, i) => ({month: Math.floor(i / 24) + 1, hour: i % 24, count: 0}));
  let validTime = 0, validHours = 0, mapped = 0, usReports = 0, mediaYes = 0;
  for (const r of reports) {
    if (r.country_iso2 === 'US') usReports++;
    if (r.eligible_for_us_state_map) { states.set(r.state_code, (states.get(r.state_code) || 0) + 1); mapped++; }
    if (!shapeMap.has(r.shape_key)) shapeMap.set(r.shape_key, {key: r.shape_key, name: r.shape_name, count: 0});
    shapeMap.get(r.shape_key).count++;
    if (!countryMap.has(r.country_key)) countryMap.set(r.country_key, {key: r.country_key, name: r.country_name, count: 0});
    countryMap.get(r.country_key).count++;
    if (r.media_available === true) mediaYes++;
    const hour = recordedHour(r);
    if (hour !== null) { validHours++; hours[hour].count++; }
    if (r.eligible_for_time_analysis) {
      validTime++;
      yearMap.set(r.year, (yearMap.get(r.year) || 0) + 1);
      if (hour !== null) heatmap[(r.month - 1) * 24 + hour].count++;
    }
  }
  const years = [...yearMap.keys()].sort((a,b) => a-b);
  const timeline = years.length ? Array.from({length: years.at(-1) - years[0] + 1}, (_, i) => ({year: years[0] + i, count: yearMap.get(years[0] + i) || 0})) : [];
  return { total: reports.length, validTime, invalidTime: reports.length - validTime, validHours, invalidHours: reports.length - validHours, mapped, usReports, unmapped: usReports - mapped, mediaYes, states, hours, heatmap, timeline, shapes: [...shapeMap.values()].sort((a,b) => b.count - a.count || a.name.localeCompare(b.name)), countries: [...countryMap.values()].sort((a,b) => b.count - a.count), years };
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
  const columns = ['report_id','occurred_at_local','city','state_name','country_name','shape_name','summary','media_status','state_population','population_year','population_status','explanation_category','explanation_certainty','quality_flags','source_url'];
  const cell = value => { let v = Array.isArray(value) ? value.join('|') : String(value ?? ''); if (/^[=+@-]/.test(v)) v = "'" + v; return '"' + v.replaceAll('"', '""') + '"'; };
  return '\uFEFF' + [columns.join(','), ...reports.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n');
}
