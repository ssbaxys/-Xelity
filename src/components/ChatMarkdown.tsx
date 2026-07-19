import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import { highlightCode } from '../lib/highlightCode';
import { splitContentWithSourceImages } from '../lib/sourceImage';
import SourceImageCard from './SourceImageCard';

type Props = {
  content: string;
  className?: string;
};

function langFromClassName(className?: string | string[]): string | null {
  const raw = Array.isArray(className) ? className.join(' ') : className ?? '';
  const m = /language-([\w+-]+)/.exec(raw);
  return m?.[1]?.toLowerCase() ?? null;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const lang = langFromClassName(className);
  const text = String(children ?? '').replace(/\n$/, '');
  const isBlock = Boolean(className) || text.includes('\n');

  if (!isBlock) {
    return <code className="chat-md-inline-code">{children}</code>;
  }

  const html = highlightCode(text, lang);
  return (
    <code
      className={`hljs${lang ? ` language-${lang}` : ''}`}
      data-lang={lang || undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const components: Components = {
  table: ({ children }) => (
    <div className="chat-md-table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  pre: ({ children }) => <pre className="chat-md-pre">{children}</pre>,
  code: CodeBlock,
  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ''} className="chat-md-img" loading="lazy" />
  ),
};

function MarkdownChunk({ content }: { content: string }) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}

/** Единый markdown для чата: GFM + KaTeX + картинки из поиска [[img: …]] */
export default function ChatMarkdown({ content, className = '' }: Props) {
  if (!content) return null;
  const parts = splitContentWithSourceImages(content);

  return (
    <div
      className={`chat-md min-w-0 max-w-full overflow-x-auto text-[15px] leading-[1.7] text-[var(--c-text)] ${className}`}
    >
      {parts.map((part, i) =>
        part.type === 'img' ? (
          <SourceImageCard key={`img-${i}`} image={part.image} />
        ) : (
          <MarkdownChunk key={`md-${i}`} content={part.text} />
        ),
      )}
    </div>
  );
}
