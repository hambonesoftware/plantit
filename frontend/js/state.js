const listeners = new Map();

export function subscribe(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  return () => unsubscribe(event, callback);
}

export function unsubscribe(event, callback) {
  if (!listeners.has(event)) {
    return;
  }
  const handlers = listeners.get(event);
  handlers.delete(callback);
  if (handlers.size === 0) {
    listeners.delete(event);
  }
}

export function emit(event, detail) {
  if (!listeners.has(event)) {
    return;
  }
  [...listeners.get(event)].forEach((handler) => {
    try {
      handler(detail);
    } catch (error) {
      console.error(`Error in event handler for "${event}":`, error);
    }
  });
}

export function once(event, callback) {
  const release = subscribe(event, (detail) => {
    release();
    callback(detail);
  });
  return release;
}

export function clearAllListeners() {
  listeners.clear();
}

export function getListenerCount(event) {
  if (!listeners.has(event)) {
    return 0;
  }
  return listeners.get(event).size;
}

export default {
  subscribe,
  unsubscribe,
  emit,
  once,
  clearAllListeners,
  getListenerCount,
};
