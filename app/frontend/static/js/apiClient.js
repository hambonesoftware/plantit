const DEFAULT_TIMEOUT = 8000;
const DEFAULT_RETRIES = 2;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, path, options = {}) {
  const {
    body,
    headers = {},
    retries = DEFAULT_RETRIES,
    timeoutMs = DEFAULT_TIMEOUT,
  } = options;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init = {
        method,
        headers: {
          Accept: 'application/json',
          ...headers,
        },
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(path, init);
      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const data = await response.json();
          if (data && typeof data === 'object' && 'detail' in data) {
            detail = data.detail;
          }
        } catch (error) {
          // ignore JSON parse errors; fall back to status text
        }
        throw new Error(`${method} ${path} failed: ${detail}`);
      }

      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) {
        throw lastError;
      }
    } finally {
      clearTimeout(timer);
    }

    attempt += 1;
    await delay(150 * attempt);
  }

  throw lastError ?? new Error(`${method} ${path} failed`);
}

export const api = {
  get(path, options) {
    return request('GET', path, options);
  },
  post(path, body, options = {}) {
    return request('POST', path, { ...options, body });
  },
  put(path, body, options = {}) {
    return request('PUT', path, { ...options, body });
  },
  delete(path, options) {
    return request('DELETE', path, options);
  },
};
