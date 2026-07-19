import { sourceRoot, type SourceImage } from '../lib/sourceImage';

type Props = {
  image: SourceImage;
};

/** Карточка: картинка + заголовок + ссылка на корень источника */
export default function SourceImageCard({ image }: Props) {
  const root = image.sourceRoot || sourceRoot(image.sourceUrl);
  let host = root;
  try {
    host = new URL(root).host;
  } catch {
    /* keep */
  }

  return (
    <figure className="source-img-card">
      <a
        href={root}
        target="_blank"
        rel="noopener noreferrer"
        className="source-img-media"
        title={image.title}
      >
        <img
          src={image.imageUrl}
          alt={image.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </a>
      <figcaption className="source-img-caption">
        <p className="source-img-title">{image.title}</p>
        <a
          href={root}
          target="_blank"
          rel="noopener noreferrer"
          className="source-img-source"
        >
          {host} /
        </a>
      </figcaption>
    </figure>
  );
}
