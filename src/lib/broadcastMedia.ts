const MAX_EDGE = 1200;
const MAX_BYTES = 400_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: таймаут`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return withTimeout(
    new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Некорректное изображение'));
      el.src = src;
    }),
    10_000,
    'decode',
  );
}

/** Сжать картинку до JPEG data URL (без Firebase Storage — не виснет) */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Не удалось определить размер картинки');

  if (w > MAX_EDGE || h > MAX_EDGE) {
    const scale = MAX_EDGE / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.drawImage(img, 0, 0, w, h);

  let q = 0.8;
  let out = canvas.toDataURL('image/jpeg', q);
  while (out.length > MAX_BYTES * 1.37 && q > 0.35) {
    q -= 0.12;
    out = canvas.toDataURL('image/jpeg', q);
  }
  if (out.length > MAX_BYTES * 1.37) {
    throw new Error('Картинка слишком большая — уменьшите файл или вставьте URL');
  }
  return out;
}

/** Загрузка баннера: локальное сжатие в data URL (+ можно вставить https URL вручную) */
export async function uploadBroadcastBanner(file: File, _uid: string): Promise<string> {
  const looksImage =
    file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
  if (!looksImage) {
    throw new Error('Нужен файл изображения');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Файл больше 8 МБ');
  }
  return compressImageToDataUrl(file);
}
