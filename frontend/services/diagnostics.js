/**
 * Clipboard helpers for diagnostics and troubleshooting flows.
 */

/**
 * Attempt to copy diagnostics text to the clipboard.
 *
 * @param {string | null | undefined} text
 * @returns {Promise<boolean>}
 */
export async function copyDiagnosticsToClipboard(text) {
  const normalized = typeof text === 'string' ? text.trim() : '';
  if (!normalized) {
    return false;
  }

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(normalized);
      return true;
    } catch (error) {
      // Fall back to execCommand approach below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = normalized;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (error) {
    success = false;
  } finally {
    textarea.remove();
  }

  return success;
}
