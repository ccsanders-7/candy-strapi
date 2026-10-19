/**
 * preview controller
 *
 * Renders any document as plain HTML for the admin Preview panel.
 */

import type { Core } from '@strapi/strapi';

const escape = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isMedia = (value: any) => value && typeof value === 'object' && 'mime' in value && 'url' in value;

const renderMedia = (file: any): string => {
  const src = escape(file.url);
  const alt = escape(file.alternativeText ?? file.name);
  if (file.mime?.startsWith('image/')) return `<img src="${src}" alt="${alt}">`;
  if (file.mime?.startsWith('video/')) return `<video src="${src}" controls></video>`;
  return `<a href="${src}">${escape(file.name)}</a>`;
};

// Strapi "blocks" rich text editor format
const renderInline = (children: any[] = []): string =>
  children
    .map((child) => {
      if (child.type === 'link') return `<a href="${escape(child.url)}">${renderInline(child.children)}</a>`;
      let text = escape(child.text);
      if (child.bold) text = `<strong>${text}</strong>`;
      if (child.italic) text = `<em>${text}</em>`;
      if (child.underline) text = `<u>${text}</u>`;
      if (child.strikethrough) text = `<s>${text}</s>`;
      if (child.code) text = `<code>${text}</code>`;
      return text;
    })
    .join('');

const renderBlocks = (blocks: any[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'heading':
          return `<h${block.level}>${renderInline(block.children)}</h${block.level}>`;
        case 'list': {
          const tag = block.format === 'ordered' ? 'ol' : 'ul';
          return `<${tag}>${block.children.map((item: any) => `<li>${renderInline(item.children)}</li>`).join('')}</${tag}>`;
        }
        case 'quote':
          return `<blockquote>${renderInline(block.children)}</blockquote>`;
        case 'code':
          return `<pre><code>${renderInline(block.children)}</code></pre>`;
        case 'image':
          return renderMedia(block.image);
        default:
          return `<p>${renderInline(block.children)}</p>`;
      }
    })
    .join('');

const isBlocks = (value: any) => Array.isArray(value) && value.length > 0 && value.every((b) => b?.type && Array.isArray(b.children));

const renderValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';
  if (isMedia(value)) return renderMedia(value);
  if (isBlocks(value)) return renderBlocks(value);
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (typeof value === 'object') {
    // Related document: show its display name
    if (value.documentId && !value.__component) {
      return `<span class="tag">${escape(value.title ?? value.name ?? value.Name ?? value.documentId)}</span>`;
    }
    return `<section class="component">${renderFields(value)}</section>`;
  }
  return `<div class="text">${escape(value)}</div>`;
};

const HIDDEN_FIELDS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations', 'createdBy', 'updatedBy', '__component']);

const renderFields = (data: Record<string, any>): string =>
  Object.entries(data)
    .filter(([key]) => !HIDDEN_FIELDS.has(key))
    .map(([key, value]) => {
      const html = renderValue(value);
      return html ? `<div class="field"><div class="label">${escape(key)}</div>${html}</div>` : '';
    })
    .join('');

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async render(ctx: any) {
    const { uid, documentId, locale, status, secret } = ctx.query as Record<string, string>;

    if (!secret || secret !== process.env.PREVIEW_SECRET) {
      return ctx.unauthorized('Invalid preview secret');
    }
    const contentType = uid ? strapi.contentType(uid as any) : undefined;
    if (!contentType) {
      return ctx.badRequest('Unknown content type');
    }

    // Populate one level deep, including media inside dynamic zones / components
    const populate = Object.fromEntries(
      Object.entries(contentType.attributes)
        .filter(([, attr]: [string, any]) => ['relation', 'media', 'component', 'dynamiczone'].includes(attr.type))
        .map(([name, attr]: [string, any]) => [name, attr.type === 'dynamiczone' || attr.type === 'component' ? { populate: '*' } : true])
    );

    const document = await strapi.documents(uid as any).findOne({
      documentId,
      locale: locale || undefined,
      status: (status as 'draft' | 'published') || undefined,
      populate,
    } as any);

    if (!document) {
      return ctx.notFound('Document not found');
    }

    const heading = document.title ?? document.name ?? document.Name ?? contentType.info.displayName;

    ctx.type = 'html';
    ctx.body = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(heading)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #222; }
    .field { margin-bottom: 1.5rem; }
    .label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #888; }
    .text { white-space: pre-wrap; }
    .component { border-left: 3px solid #ddd; padding-left: 1rem; margin: .5rem 0; }
    .tag { display: inline-block; background: #eef; border-radius: 4px; padding: 0 .5rem; margin-right: .25rem; }
    .status { font-size: .8rem; color: #888; }
    img, video { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <p class="status">${escape(contentType.info.displayName)} · ${escape(status ?? 'published')}${locale ? ` · ${escape(locale)}` : ''}</p>
  <h1>${escape(heading)}</h1>
  ${renderFields(document)}
</body>
</html>`;
  },
});
