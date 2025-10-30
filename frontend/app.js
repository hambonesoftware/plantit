const doc = document.documentElement;
doc.dataset.boot = 't1';

const logArea = document.getElementById('log');
function log(message, data) {
  const stamp = new Date().toISOString();
  const details = data ? `\n${JSON.stringify(data, null, 2)}` : '';
  logArea.textContent = `[${stamp}] ${message}${details}\n\n` + logArea.textContent;
}

async function pingHealth() {
  log('Pinging /api/health …');
  try {
    const res = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    log('Received /api/health response', await res.json());
  } catch (error) {
    log('Failed to reach /api/health', { error: String(error) });
  }
}

async function sendEcho() {
  log('Sending /api/echo payload …');
  const payload = {
    message: 'Hello from SafeBoot',
    sentAt: new Date().toISOString(),
  };
  try {
    const res = await fetch('/api/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    log('Received /api/echo response', await res.json());
  } catch (error) {
    log('Failed to reach /api/echo', { error: String(error) });
  }
}

const pingButton = document.getElementById('ping');
const echoButton = document.getElementById('echo');

if (pingButton) {
  pingButton.addEventListener('click', pingHealth);
}

if (echoButton) {
  echoButton.addEventListener('click', sendEcho);
}

requestAnimationFrame(() => {
  doc.dataset.boot = 't2';
});
