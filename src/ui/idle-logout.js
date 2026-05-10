export function getIdleLogoutScript(config = {}) {
  const idleTimeoutMs = config.idle_timeout_ms || 1800000;
  const idleWarningMs = config.idle_warning_ms || 1500000;
  const warningConfig = config.idle_warning_dialog_config || {};

  return `
(function() {
  let idleTimer = null;
  let warningTimer = null;
  let isWarningShown = false;

  const CONFIG = {
    idleTimeoutMs: ${idleTimeoutMs},
    idleWarningMs: ${idleWarningMs},
    warningTitle: '${warningConfig.title || 'Session Expiring'}',
    warningMessage: '${warningConfig.message || 'Your session will expire due to inactivity'}',
    stayButtonLabel: '${warningConfig.buttons?.[0]?.label || 'Stay Logged In'}',
    logoutButtonLabel: '${warningConfig.buttons?.[1]?.label || 'Logout'}'
  };

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    clearTimeout(warningTimer);
    isWarningShown = false;
    removeWarningDialog();

    warningTimer = setTimeout(() => {
      showWarningDialog();
    }, CONFIG.idleWarningMs);

    idleTimer = setTimeout(() => {
      logout();
    }, CONFIG.idleTimeoutMs);
  }

  function showWarningDialog() {
    if (isWarningShown) return;
    isWarningShown = true;

    const dialog = document.createElement('div');
    dialog.id = 'idle-warning-dialog';
    dialog.style.cssText = \`
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    \`;

    const content = document.createElement('div');
    content.style.cssText = \`
      background: var(--color-surface, #fff);
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      max-width: 400px;
      text-align: center;
      color: var(--color-text, #111);
    \`;

    const title = document.createElement('h3');
    title.textContent = CONFIG.warningTitle;
    title.style.marginBottom = '1rem';
    title.style.color = 'var(--color-text, #333)';

    const message = document.createElement('p');
    message.textContent = CONFIG.warningMessage;
    message.style.marginBottom = '1.5rem';
    message.style.color = 'var(--color-text-muted, #666)';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 1rem;';

    const stayBtn = document.createElement('button');
    stayBtn.textContent = CONFIG.stayButtonLabel;
    stayBtn.style.cssText = \`
      flex: 1;
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    \`;
    stayBtn.onclick = () => {
      removeWarningDialog();
      resetIdleTimer();
    };

    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = CONFIG.logoutButtonLabel;
    logoutBtn.style.cssText = \`
      flex: 1;
      padding: 0.75rem;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
    \`;
    logoutBtn.onclick = logout;

    buttonContainer.appendChild(stayBtn);
    buttonContainer.appendChild(logoutBtn);

    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(buttonContainer);
    dialog.appendChild(content);
    document.body.appendChild(dialog);
  }

  function removeWarningDialog() {
    const dialog = document.getElementById('idle-warning-dialog');
    if (dialog) dialog.remove();
  }

  function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/login';
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }

  const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

  events.forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
  });

  resetIdleTimer();

  window.idleLogout = { resetIdleTimer, logout };
})();
`;
}

export function injectIdleLogoutScript(html, config = {}) {
  const script = getIdleLogoutScript(config);
  const tag = `<script>${script}</script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${tag}</body>`);
  }
  return html + tag;
}
