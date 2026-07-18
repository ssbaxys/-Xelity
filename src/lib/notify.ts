/** Уведомления и звуки (Web Audio) — без внешних файлов */

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number };

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

async function ensureRunning() {
  const c = ctx();
  if (!c) return null;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      return null;
    }
  }
  return c;
}

function playTones(tones: Tone[]) {
  void (async () => {
    const c = await ensureRunning();
    if (!c) return;
    let t = c.currentTime + 0.02;
    for (const tone of tones) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tone.type || 'sine';
      osc.frequency.value = tone.freq;
      const g = tone.gain ?? 0.08;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(g, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + tone.dur + 0.02);
      t += tone.dur * 0.85;
    }
  })();
}

/** Короткий «пинг» — ответ готов */
export function playGenerationDoneSound() {
  playTones([
    { freq: 523.25, dur: 0.09, type: 'triangle', gain: 0.07 },
    { freq: 659.25, dur: 0.12, type: 'triangle', gain: 0.08 },
    { freq: 783.99, dur: 0.16, type: 'sine', gain: 0.06 },
  ]);
}

/** Мягкий клик — общее уведомление */
export function playNotifySound() {
  playTones([
    { freq: 880, dur: 0.07, type: 'sine', gain: 0.05 },
    { freq: 1174.66, dur: 0.1, type: 'sine', gain: 0.045 },
  ]);
}

export async function requestDesktopNotifyPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function showDesktopNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'xelity-chat',
      silent: true,
    });
    window.setTimeout(() => n.close(), 6000);
  } catch {
    /* ignore */
  }
}

export function notifyGenerationDone(opts: {
  sounds: boolean;
  desktop: boolean;
  title?: string;
  body?: string;
}) {
  if (opts.sounds) playGenerationDoneSound();
  if (opts.desktop) {
    showDesktopNotification(
      opts.title || 'Xelity',
      opts.body || 'Ответ модели готов',
    );
  }
}
