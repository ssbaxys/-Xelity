/** Картинки из поиска: разметка для ответа ИИ и корень источника */

export type SourceImage = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  /** https://host/ */
  sourceRoot: string;
};

/** Корень сайта: схема + хост + / */
export function sourceRoot(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw.trim();
    return `${u.protocol}//${u.host}/`;
  } catch {
    return raw.trim();
  }
}

/**
 * Блок в ответе модели:
 * [[img: Заголовок | https://…/pic.jpg | https://site.com/article]]
 */
export const SOURCE_IMG_RE =
  /\[\[img:\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\|\s*([^|\]]+?)\s*\]\]/gi;

export function parseSourceImageBlock(
  title: string,
  imageUrl: string,
  sourceUrl: string,
): SourceImage | null {
  const img = imageUrl.trim();
  const src = sourceUrl.trim();
  const t = title.trim().slice(0, 200);
  if (!t || !/^https?:\/\//i.test(img) || !/^https?:\/\//i.test(src)) return null;
  return {
    title: t,
    imageUrl: img.slice(0, 2000),
    sourceUrl: src.slice(0, 2000),
    sourceRoot: sourceRoot(src),
  };
}

export type ContentPart =
  | { type: 'md'; text: string }
  | { type: 'img'; image: SourceImage };

/** Разбить ответ на markdown и карточки картинок */
export function splitContentWithSourceImages(content: string): ContentPart[] {
  if (!content) return [];
  const parts: ContentPart[] = [];
  let last = 0;
  const re = new RegExp(SOURCE_IMG_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'md', text: content.slice(last, m.index) });
    }
    const image = parseSourceImageBlock(m[1] || '', m[2] || '', m[3] || '');
    if (image) parts.push({ type: 'img', image });
    else parts.push({ type: 'md', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    parts.push({ type: 'md', text: content.slice(last) });
  }
  return parts.length ? parts : [{ type: 'md', text: content }];
}
