import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const MAX_EDGE = 1400;
const MAX_BYTES = 450_000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(file);
  });
}

/** Сжать картинку до JPEG data URL (fallback без Storage) */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const raw = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Некорректное изображение'));
    el.src = raw;
  });

  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
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

  let q = 0.85;
  let out = canvas.toDataURL('image/jpeg', q);
  while (out.length > MAX_BYTES * 1.37 && q > 0.45) {
    q -= 0.1;
    out = canvas.toDataURL('image/jpeg', q);
  }
  if (out.length > MAX_BYTES * 1.37) {
    throw new Error('Картинка слишком большая — уменьшите файл или вставьте URL');
  }
  return out;
}

/** Загрузка баннера: Firebase Storage → иначе сжатый data URL */
export async function uploadBroadcastBanner(
  file: File,
  uid: string,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужен файл изображения');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Файл больше 8 МБ');
  }

  const ext = file.type.includes('png')
    ? 'png'
    : file.type.includes('webp')
      ? 'webp'
      : 'jpg';
  const path = `broadcasts/${uid}/${Date.now().toString(36)}.${ext}`;

  try {
    const r = storageRef(storage, path);
    await uploadBytes(r, file, { contentType: file.type });
    return await getDownloadURL(r);
  } catch {
    return compressImageToDataUrl(file);
  }
}
