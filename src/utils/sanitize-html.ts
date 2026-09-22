import DOMPurify from 'dompurify';

/**
 * Sanitizes API-provided HTML before it is rendered with v-html.
 *
 * Used for externally sourced markup (image attributions from Camptocamp and
 * other providers, weather condition labels). The data legitimately contains
 * links (license attribution) and images with inline styles (provider logos),
 * so the allowlist keeps those - everything else (script, event handlers,
 * javascript: URLs) is stripped.
 */
const ALLOWED_TAGS = ['a', 'img', 'span', 'b', 'strong', 'i', 'em', 'br'];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel', 'style'];

// Enforce a safe rel on links that open a new tab (reverse tabnabbing).
// Guarded so repeated module evaluation (HMR) does not stack hooks.
let hookInstalled = false;
if (!hookInstalled) {
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
  hookInstalled = true;
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
