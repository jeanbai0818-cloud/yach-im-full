'use strict';

// One process-wide bridge shared by the yach-im-full NIM service and the
// migrated yach-im-full API layer. Tool calls always reuse the service's
// connected SDK instance instead of creating a second NIM client.
let activeListener = null;

function setActiveListener(listener) {
  activeListener = listener || null;
}

function clearActiveListener(listener) {
  if (!listener || activeListener === listener) activeListener = null;
}

function getActiveListener() {
  return activeListener;
}

function getActiveNim() {
  return activeListener?.isConnected ? activeListener.nim : null;
}

function hasActiveListener() {
  return Boolean(activeListener);
}

function waitForActiveNim(timeoutMs = 15_000) {
  const listener = activeListener;
  const connected = getActiveNim();
  if (connected) return Promise.resolve(connected);
  if (!listener) return Promise.reject(new Error('NIM service listener is not registered'));
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      listener.off?.('connect', onConnect);
      listener.off?.('disconnect', onDisconnect);
    };
    const onConnect = () => {
      const nim = listener.nim;
      cleanup();
      if (nim) resolve(nim);
      else reject(new Error('NIM service connected without a client instance'));
    };
    const onDisconnect = (error) => {
      cleanup();
      reject(new Error(`NIM service disconnected: ${error?.message || error || 'unknown error'}`));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`NIM service connect timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    listener.once?.('connect', onConnect);
    listener.once?.('disconnect', onDisconnect);
  });
}

module.exports = {
  setActiveListener,
  clearActiveListener,
  getActiveListener,
  getActiveNim,
  hasActiveListener,
  waitForActiveNim,
};
