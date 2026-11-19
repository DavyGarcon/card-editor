import DOMPurify from 'dompurify';

/** Only the tags understood by `parseRichTextToSegments` are kept. */
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'br', 'div', 'p', 'ul', 'ol', 'li', 'span'];

export function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
}
