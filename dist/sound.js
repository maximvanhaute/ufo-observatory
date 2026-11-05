const PREFERENCE_KEY = 'ufo-observatory-sound';
const AudioEngine = window.AudioContext || window.webkitAudioContext;
const VOLUME = 0.28;

const CUES = {
  click: [
    {type: 'triangle', from: 660, to: 420, delay: 0, duration: 0.045, level: 0.17},
  ],
  radar: [
    {type: 'sine', from: 610, to: 870, delay: 0, duration: 0.11, level: 0.22},
    {type: 'sine', from: 870, to: 715, delay: 0.07, duration: 0.10, level: 0.10},
  ],
  report: [
    {type: 'sine', from: 392, to: 392, delay: 0, duration: 0.13, level: 0.19},
    {type: 'sine', from: 587, to: 587, delay: 0.08, duration: 0.16, level: 0.18},
  ],
  alien: [
    {type: 'triangle', from: 280, to: 790, delay: 0, duration: 0.12, level: 0.19},
    {type: 'triangle', from: 950, to: 480, delay: 0.09, duration: 0.14, level: 0.18},
    {type: 'sine', from: 370, to: 640, delay: 0.19, duration: 0.10, level: 0.14},
  ],
};

let enabled = false;
let context;
let output;
let request = 0;
let lastStart = -Infinity;

function playNote(note, start) {
  const onset = start + note.delay;
  const end = onset + note.duration;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.from, onset);
  oscillator.frequency.exponentialRampToValueAtTime(note.to, end);
  envelope.gain.setValueAtTime(0.0001, onset);
  envelope.gain.exponentialRampToValueAtTime(note.level, onset + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(envelope).connect(output);
  oscillator.start(onset);
  oscillator.stop(end);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

export async function playSound(cue) {
  if (!enabled) return;
  const current = ++request;
  try {
    if (!context) {
      context = new AudioEngine();
      output = context.createGain();
      output.gain.value = VOLUME;
      output.connect(context.destination);
    }
    if (context.state !== 'running') await context.resume();
    if (!enabled || current !== request || context.state !== 'running') return;

    const start = context.currentTime;
    if (start - lastStart < 0.06) return;
    lastStart = start;
    for (const note of CUES[cue]) playNote(note, start);
  } catch {
    // Sound is optional when the browser cannot start audio.
  }
}

export function initSoundControls(button) {
  if (!AudioEngine) return;
  try {
    enabled = localStorage.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    // The toggle still works for this page if storage is blocked.
  }
  button.setAttribute('aria-pressed', String(enabled));
  button.hidden = false;

  button.addEventListener('click', () => {
    enabled = !enabled;
    button.setAttribute('aria-pressed', String(enabled));
    try {
      localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Keep the in-page preference.
    }
    if (output) output.gain.setTargetAtTime(enabled ? VOLUME : 0, context.currentTime, 0.006);
    if (enabled) {
      lastStart = -Infinity;
      void playSound('alien');
    } else {
      request++;
    }
  });

  // Capture activation before a control's handler can replace it during rendering.
  document.addEventListener('click', event => {
    if (!enabled) return;
    const control = event.target.closest('button, a[data-view], summary');
    if (!control || control === button || control.matches(':disabled, [aria-disabled="true"]')) return;
    void playSound(control.dataset.sound || (control.hasAttribute('data-report') ? 'report' : 'click'));
  }, {capture: true});
}
