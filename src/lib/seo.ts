const SITE = 'https://xelity.ru';
const DEFAULT_TITLE = 'Xelity — меньше театра, больше ответа';
const DEFAULT_DESCRIPTION =
  'Xelity — чат на моделях Xlaude Mini и Pro (K1 / K2). Ясные ответы, дневные кредиты и рабочее пространство без лишнего шума.';

type PageMeta = {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function setPageMeta({
  title,
  description,
  path = '/',
  noindex = false,
}: PageMeta) {
  const fullTitle = title
    ? title.includes('Xelity')
      ? title
      : `${title} — Xelity`
    : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = path === '/' ? `${SITE}/` : `${SITE}${path.startsWith('/') ? path : `/${path}`}`;

  document.title = fullTitle;
  upsertMeta('name', 'description', desc);
  upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', desc);
  upsertMeta('property', 'og:url', url);
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', desc);
  upsertLink('canonical', url);
}

export { DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE };
