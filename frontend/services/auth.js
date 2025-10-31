/**
 * Lightweight helpers around the backend's auth endpoints.
 */

import { HttpError, request } from './api.js';

/**
 * Fetch the current authentication status.
 *
 * @param {string} [correlationId]
 * @returns {Promise<{ authEnabled: boolean, authenticated: boolean, username: string | null }>}
 */
export function fetchAuthStatus(correlationId) {
  return request('/auth/status', { correlationId });
}

/**
 * Attempt to log in with the provided credentials.
 *
 * @param {{ username: string, password: string }} credentials
 * @param {string} [correlationId]
 * @returns {Promise<{ authEnabled: boolean, authenticated: boolean, username: string | null }>}
 */
export function login(credentials, correlationId) {
  return request('/auth/login', {
    method: 'POST',
    body: credentials,
    correlationId,
  });
}

/**
 * Terminate the current authenticated session.
 *
 * @param {string} [correlationId]
 * @returns {Promise<{ authEnabled: boolean, authenticated: boolean, username: string | null }>}
 */
export function logout(correlationId) {
  return request('/auth/logout', {
    method: 'POST',
    correlationId,
  });
}

/**
 * Determine whether an error represents an HTTP 401 response.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isUnauthorizedError(error) {
  return error instanceof HttpError && error.status === 401;
}
