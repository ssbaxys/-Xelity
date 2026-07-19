import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';

type Props = {
  content: string;
  className?: string;
};

function langFromClassName(className?: string | string[]): string | null {
  const raw = Array.isArray(className) ? className.join(' ') : className ?? '';
  const m = /language-([\w+-]+)/.exec(raw);
  return m?.[1] ?? null;
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
  code: ({ className, children, ...props }) => {
    const lang = langFromClassName(className);
    // fenced / multiline = блок (стили через .chat-md pre code)
    if (className || (typeof children === 'string' && children.includes('\n'))) {
      return (
        <code className={className} data-lang={lang || undefined} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="chat-md-inline-code" {...props}>
        {children}
      </code>
    );
  },
  img: ({ src, alt }) => <img src={src} alt={alt ?? ''} className="chat-md-img" loading="lazy" />,
};

/** Единый markdown для чата: GFM (таблицы/списки) + KaTeX */
export default function ChatMarkdown({ content, className = '' }: Props) {
  if (!content) return null;
  return (
    <div
      className={`chat-md min-w-0 max-w-full overflow-x-auto text-[15px] leading-[1.7] text-[var(--c-text)] ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
