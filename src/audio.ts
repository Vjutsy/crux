/**
 * Звук без файлів: короткі синтезовані ефекти й тиха фонова музика через Web Audio.
 * AudioContext створюється лише після першого жесту користувача (вимога браузерів).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let soundOn = true;
let musicOn = true;
let musicTimer: ReturnType<typeof setInterval> | undefined;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.12;
  musicGain.connect(master);
  return ctx;
}

/** Викликати з обробника кліку/тапу. */
export function unlockAudio() {
  const c = ensure();
  if (c?.state === 'suspended') void c.resume();
  if (musicOn) startMusic();
}

export function setAudio(opts: { sound: boolean; music: boolean }) {
  soundOn = opts.sound;
  musicOn = opts.music;
  if (musicOn && ctx) startMusic();
  else stopMusic();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, when = 0, dest?: AudioNode, slideTo?: number) {
  const c = ctx;
  if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const sfx = (fn: () => void) => () => {
  if (soundOn && ensure()) fn();
};

export const sound = {
  tap: sfx(() => tone(660, 0.06, 'triangle', 0.15)),
  good: sfx(() => {
    tone(523, 0.12, 'triangle', 0.25);
    tone(784, 0.18, 'triangle', 0.25, 0.08);
  }),
  bad: sfx(() => tone(220, 0.35, 'sawtooth', 0.12, 0, undefined, 110)),
  combo: sfx(() => [659, 784, 988].forEach((f, i) => tone(f, 0.12, 'square', 0.1, i * 0.07))),
  slip: sfx(() => tone(400, 0.3, 'sine', 0.2, 0, undefined, 120)),
  fall: sfx(() => tone(500, 0.9, 'sine', 0.25, 0, undefined, 60)),
  win: sfx(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.22, i * 0.12))),
  heartbeat: sfx(() => {
    tone(70, 0.12, 'sine', 0.5);
    tone(60, 0.14, 'sine', 0.4, 0.16);
  }),
};

// Тиха музика: повільне арпеджіо пентатоніки, щоразу трохи інше.
const SCALE = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];
function startMusic() {
  if (musicTimer || !ensure() || !musicGain) return;
  let step = 0;
  const bar = () => {
    if (!ctx || !musicGain) return;
    const root = [0, 3, 4, 2][Math.floor(step / 4) % 4]!;
    for (let i = 0; i < 4; i++) {
      const f = SCALE[(root + [0, 2, 4, 2][i]!) % SCALE.length]! / 2;
      tone(f, 1.6, 'sine', 0.5, i * 0.5, musicGain);
    }
    tone(SCALE[root]! / 4, 2.2, 'triangle', 0.35, 0, musicGain);
    step++;
  };
  bar();
  musicTimer = setInterval(bar, 2000);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = undefined;
}

// Не грати у фоні, коли вкладку згорнули.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});
