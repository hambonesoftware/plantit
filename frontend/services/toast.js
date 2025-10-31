const DEFAULT_DURATION = 6000;

let toastHost = null;

/**
 * Create a host element for toast notifications.
 *
 * @returns {HTMLElement}
 */
export function createToastHost() {
  const host = document.createElement('div');
  host.className = 'toast-host';
  Object.assign(host.style, {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '320px',
    zIndex: '1000',
    pointerEvents: 'none',
  });
  return host;
}

/**
 * Register the toast host so subsequent `showToast` calls can render into it.
 *
 * @param {HTMLElement | null} element
 */
export function registerToastHost(element) {
  toastHost = element;
}

/**
 * Display a toast message.
 *
 * @param {{ message: string, tone?: 'info'|'success'|'warning'|'error', correlationId?: string, duration?: number }} options
 */
export function showToast(options) {
  if (!toastHost) {
    console.warn('Toast host not registered; dropping toast', options);
    return;
  }

  const { message, tone = 'info', correlationId, duration = DEFAULT_DURATION } = options ?? {};
  if (!message) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.dataset.tone = tone;
  Object.assign(toast.style, {
    backgroundColor: tone === 'error'
      ? 'rgba(185, 28, 28, 0.92)'
      : tone === 'warning'
      ? 'rgba(217, 119, 6, 0.92)'
      : tone === 'success'
      ? 'rgba(16, 122, 87, 0.92)'
      : 'rgba(30, 64, 175, 0.92)',
    color: '#fff',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.25)',
    pointerEvents: 'auto',
    fontSize: '0.95rem',
  });

  const messageLine = document.createElement('p');
  messageLine.textContent = message;
  messageLine.style.margin = '0';
  toast.append(messageLine);

  if (correlationId) {
    const idLine = document.createElement('p');
    idLine.textContent = `Correlation ID: ${correlationId}`;
    idLine.style.margin = '0.35rem 0 0';
    idLine.style.fontSize = '0.8rem';
    idLine.style.opacity = '0.85';
    toast.append(idLine);
  }

  toastHost.append(toast);

  const removal = () => {
    toast.remove();
  };

  const timeoutId = window.setTimeout(removal, duration);
  toast.addEventListener('click', () => {
    window.clearTimeout(timeoutId);
    removal();
  });
}
