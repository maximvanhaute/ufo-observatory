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

let enabled = true;
let context;
let output;
let request = 0;
let lastStart = -Infinity;
let openingAudio, openingControl;
let openingPending = false, openingPlayed = false, openingAttempt = 0;

function updateOpeningControl() {
  const playing = !openingAudio.paused && !openingAudio.ended;
  const label = playing ? 'Stop opening sound' : openingPlayed ? 'Replay opening sound' : 'Play opening sound';
  openingControl.setAttribute('aria-label', label);
  openingControl.setAttribute('aria-pressed', String(playing));
  openingControl.title = label;
  openingControl.querySelector('span').textContent = playing ? 'Stop intro' : openingPlayed ? 'Replay intro' : 'Play intro';
}

function stopOpeningSound() {
  openingAttempt++;
  openingPending = false;
  openingAudio.pause();
  openingAudio.currentTime = 0;
  updateOpeningControl();
}

async function playOpeningSound() {
  if (!enabled || openingControl.disabled) return;
  const attempt = ++openingAttempt;
  openingPending = false;
  try {
    openingAudio.currentTime = 0;
    await openingAudio.play();
    if (attempt !== openingAttempt) return;
    openingPlayed = true;
    updateOpeningControl();
  } catch (error) {
    if (attempt !== openingAttempt) return;
    openingPending = enabled && error.name === 'NotAllowedError';
    updateOpeningControl();
  }
}

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
  if (!enabled || (openingAudio && !openingAudio.paused)) return;
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
  openingAudio = document.getElementById('opening-audio');
  openingControl = document.getElementById('opening-sound');
  openingAudio.volume = 0.3;
  openingControl.hidden = false;
  for (const event of ['playing', 'pause', 'ended']) openingAudio.addEventListener(event, updateOpeningControl);
  openingAudio.addEventListener('error', () => {
    openingPending = false;
    openingControl.disabled = true;
    openingControl.title = 'The opening sound could not be loaded';
    openingControl.setAttribute('aria-label', 'Opening sound unavailable');
    openingControl.querySelector('span').textContent = 'Intro unavailable';
  });
  openingControl.addEventListener('click', () => {
    if (!openingAudio.paused) {stopOpeningSound();return;}
    enabled = true;
    button.setAttribute('aria-pressed', 'true');
    try {localStorage.setItem(PREFERENCE_KEY, 'on');} catch {}
    if (output) output.gain.setTargetAtTime(VOLUME, context.currentTime, 0.006);
    void playOpeningSound();
  });
  try {
    enabled = localStorage.getItem(PREFERENCE_KEY) !== 'off';
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
      if (!openingPlayed) void playOpeningSound();
      else void playSound('alien');
    } else {
      request++;
      stopOpeningSound();
    }
  });

  // Capture activation before a control's handler can replace it during rendering.
  document.addEventListener('click', event => {
    if (!enabled) return;
    const control = event.target.closest('button, a[data-view], summary');
    if (control === button || control === openingControl) return;
    if (openingPending && !openingPlayed) void playOpeningSound();
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
    void playSound(control.dataset.sound || (control.hasAttribute('data-report') ? 'report' : 'click'));
  }, {capture: true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !openingAudio.paused) stopOpeningSound();
  });
  updateOpeningControl();
  if (enabled) void playOpeningSound();
}
