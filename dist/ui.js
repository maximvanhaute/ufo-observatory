export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const paths = {
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
  chart:'<path d="M5 20V10m7 10V4m7 16v-7"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  shapes:'<path d="m6 3 4 7H2l4-7Z"/><circle cx="17" cy="7" r="4"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="m17 13 4 4-4 4-4-4 4-4Z"/>',
  sliders:'<path d="M3 7h5m5 0h8M3 17h11m5 0h2"/><circle cx="10" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  link:'<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  file:'<path d="M5 3h9l5 5v13H5V3Zm9 0v6h5M8 13h8M8 17h6"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h2m4 0h2m-8 4h2"/>',
  trend:'<path d="M3 19V5m0 14h18M6 15l5-5 4 3 6-8m-5 0h5v5"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 16 6-6 5 5 3-3 4 4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
  sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>'
};
export function icon(name) {return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;}
export function shapeIcon(key) {
  const p = key === 'triangle' ? '<path d="m12 3 10 18H2L12 3Z"/>' : key === 'disk' || key === 'oval' ? '<ellipse cx="12" cy="12" rx="10" ry="5"/>' : ['orb','sphere','circle'].includes(key) ? '<circle cx="12" cy="12" r="8"/>' : key === 'rectangle' || key === 'cube' ? '<rect x="4" y="5" width="16" height="14" rx="1"/>' : key === 'cigar' || key === 'cylinder' ? '<rect x="2" y="8" width="20" height="8" rx="4"/>' : key === 'chevron' ? '<path d="m2 16 10-10 10 10-10-5-10 5Z"/>' : '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>';
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(element => element.replaceWith(htmlElement(icon(element.dataset.icon)))); }
function htmlElement(html) {const template = document.createElement('template'); template.innerHTML = html; return template.content.firstChild;}
export function number(value) {return new Intl.NumberFormat('en-US').format(value);}

export function showTooltip(event, message) {
  const tip = document.getElementById('chart-tooltip');
  tip.textContent = message; tip.hidden = false;
  const box = event.currentTarget.getBoundingClientRect();
  let x = Number.isFinite(event.clientX) && event.clientX !== 0 ? event.clientX + 14 : box.left + box.width / 2;
  let y = Number.isFinite(event.clientY) && event.clientY !== 0 ? event.clientY + 14 : box.bottom + 8;
  x = Math.max(8, Math.min(x, window.innerWidth - tip.offsetWidth - 10));
  y = Math.max(8, Math.min(y, window.innerHeight - tip.offsetHeight - 10));
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
export function hideTooltip() {document.getElementById('chart-tooltip').hidden = true;}
export function bindMark(element, {label, tooltip, action, tabIndex = 0}) {
  element.setAttribute('role', 'button'); element.setAttribute('tabindex', String(tabIndex)); element.setAttribute('aria-label', label);
  element.addEventListener('pointermove', event => showTooltip(event, tooltip));
  element.addEventListener('pointerleave', hideTooltip);
  element.addEventListener('focus', event => showTooltip(event, tooltip));
  element.addEventListener('blur', hideTooltip);
  element.addEventListener('click', () => {hideTooltip(); action();});
  element.addEventListener('keydown', event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); hideTooltip(); action();}});
}
