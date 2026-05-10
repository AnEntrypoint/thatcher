export function renderPasswordResetPage(params = {}) {
  const token = params.token || '';
  const isConfirm = !!token;
  const title = isConfirm ? 'Set New Password' : 'Forgot Password';
  const subtitle = isConfirm ? 'Enter your new password below' : 'Enter your email to receive a reset link';
  const btnLabel = isConfirm ? 'Update Password' : 'Send Reset Link';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Moonlanding</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--bg:#f1f5f9;--surface:#fff;--border:#e2e8f0;--text:#0f172a;--text-muted:#64748b;--primary:#04141f;--accent:#2563eb;--danger:#b91c1c;--danger-bg:#fee2e2;--danger-border:#fca5a5;--success-bg:#dcfce7;--success:#15803d;--success-border:#86efac;--info-bg:#dbeafe;--info:#1d4ed8;--info-border:#93c5fd}
    @media(prefers-color-scheme:dark){:root{--bg:#0f172a;--surface:#1a1a1a;--border:#334155;--text:#f1f5f9;--text-muted:#94a3b8;--primary:#1e3a5f}}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--text)}
    .wrap{width:100%;max-width:400px}
    .logo{text-align:center;margin-bottom:32px}
    .logo-mark{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:var(--primary);border-radius:14px;margin-bottom:14px;box-shadow:0 4px 12px rgba(4,20,31,0.25)}
    .logo-name{font-size:1.35rem;font-weight:800;color:var(--text);letter-spacing:0.5px;display:block;margin-bottom:4px}
    .logo-sub{color:var(--text-muted);font-size:0.875rem}
    .card{background:var(--surface);border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.09);padding:32px;border:1px solid var(--border)}
    .field{margin-bottom:18px}
    label{display:block;font-size:0.8125rem;font-weight:600;color:var(--text);margin-bottom:6px}
    input{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.15s,box-shadow 0.15s;background:var(--surface);color:var(--text);min-height:44px}
    input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
    input::placeholder{color:var(--text-muted)}
    .submit-btn{width:100%;padding:12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:0.9375rem;font-weight:600;cursor:pointer;transition:all 0.15s;min-height:46px;margin-top:4px}
    .submit-btn:hover:not(:disabled){background:#0a2535}
    .submit-btn:disabled{opacity:0.65;cursor:not-allowed}
    .submit-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .alert{padding:11px 14px;border-radius:8px;margin-bottom:18px;font-size:0.875rem;border:1px solid;line-height:1.4}
    .alert-error{background:var(--danger-bg);color:var(--danger);border-color:var(--danger-border)}
    .alert-success{background:var(--success-bg);color:var(--success);border-color:var(--success-border)}
    .alert-info{background:var(--info-bg);color:var(--info);border-color:var(--info-border)}
    .back{text-align:center;margin-top:18px;font-size:0.875rem;color:var(--text-muted)}
    .back a{color:var(--accent);text-decoration:none;font-weight:500}
    .back a:hover{text-decoration:underline}
    @media(prefers-color-scheme:dark){
      .card{background:#1a1a1a;border-color:#334155;box-shadow:0 4px 24px rgba(0,0,0,0.4)}
      input{background:#1a1a1a;border-color:#334155;color:#f1f5f9}
      .submit-btn{background:#1e3a5f}
      .submit-btn:hover:not(:disabled){background:#1e293b}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">
      <div class="logo-mark">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m4.24-4.24l4.24-4.24"/></svg>
      </div>
      <span class="logo-name">MOONLANDING</span>
      <div class="logo-sub">${subtitle}</div>
    </div>
    <div class="card">
      <div id="alertContainer" role="alert" aria-live="assertive"></div>
      <form id="resetForm" aria-label="${title}" novalidate>
        ${!isConfirm ? `
          <div class="field">
            <label for="email">Email address</label>
            <input type="email" name="email" id="email" placeholder="you@example.com" required autocomplete="email" autofocus>
          </div>
          <button type="submit" id="submitBtn" class="submit-btn">${btnLabel}</button>
        ` : `
          <input type="hidden" name="token" value="${token}">
          <div class="field">
            <label for="password">New password</label>
            <input type="password" name="password" id="password" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password" autofocus>
          </div>
          <div class="field">
            <label for="confirm">Confirm new password</label>
            <input type="password" name="confirm" id="confirm" placeholder="Same password again" required minlength="8" autocomplete="new-password">
          </div>
          <button type="submit" id="submitBtn" class="submit-btn">${btnLabel}</button>
        `}
      </form>
      <div class="back"><a href="/login">Back to sign in</a></div>
    </div>
  </div>
  <script src="/ui/event-delegation.js"></script>
  <script>
    var form = document.getElementById('resetForm');
    var submitBtn = document.getElementById('submitBtn');
    var alertContainer = document.getElementById('alertContainer');
    var isConfirm = ${isConfirm};

    function showAlert(message, type) {
      alertContainer.innerHTML = '<div class="alert alert-' + (type || 'error') + '">' + message + '</div>';
    }

    if (isConfirm && !form.token.value) {
      showAlert('Invalid or expired reset link. Please request a new one.', 'error');
      submitBtn.disabled = true;
    }

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      alertContainer.innerHTML = '';
      var formData = new FormData(form);
      var data = Object.fromEntries(formData);

      if (isConfirm && data.password !== data.confirm) {
        showAlert('Passwords do not match.', 'error');
        return;
      }

      var origText = submitBtn.textContent;
      submitBtn.textContent = isConfirm ? 'Updating\u2026' : 'Sending\u2026';
      submitBtn.disabled = true;

      try {
        var body = isConfirm ? { token: data.token, password: data.password } : { email: data.email };
        var res = await fetch('/api/auth/password-reset', {
          method: isConfirm ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        var result = await res.json().catch(function() { return {}; });
        if (res.ok) {
          if (isConfirm) {
            showAlert('Password updated. <a href="/login" style="color:var(--success);font-weight:600;text-decoration:underline">Sign in now</a>', 'success');
            form.style.display = 'none';
          } else {
            form.reset();
            showAlert('If an account exists with that email, a reset link has been sent.', 'info');
            submitBtn.textContent = origText;
            submitBtn.disabled = false;
          }
        } else {
          showAlert(result.error || 'An error occurred. Please try again.', 'error');
          submitBtn.textContent = origText;
          submitBtn.disabled = false;
        }
      } catch(err) {
        showAlert('Network error. Please try again.', 'error');
        submitBtn.textContent = origText;
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
