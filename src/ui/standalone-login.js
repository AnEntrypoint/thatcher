export function renderStandaloneLogin(showGoogleAuth = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In | Moonlanding</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    :root{--bg:#f1f5f9;--surface:#fff;--border:#e2e8f0;--text:#0f172a;--text-muted:#64748b;--primary:#04141f;--primary-hover:#0a2535;--accent:#2563eb;--danger:#dc2626;--danger-bg:#fee2e2;--danger-border:#fca5a5;--radius:10px;--shadow:0 4px 24px rgba(0,0,0,0.09)}
    @media(prefers-color-scheme:dark){:root{--bg:#0f172a;--surface:#1a1a1a;--border:#334155;--text:#f1f5f9;--text-muted:#94a3b8;--primary:#1e3a5f;--primary-hover:#1e293b;--shadow:0 4px 24px rgba(0,0,0,0.4)}}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;color:var(--text);transition:background 0.2s}
    .wrap{width:100%;max-width:400px}
    .logo{text-align:center;margin-bottom:32px}
    .logo-mark{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:var(--primary);border-radius:14px;margin-bottom:14px;box-shadow:0 4px 12px rgba(4,20,31,0.25)}
    .logo-text{font-size:1.35rem;font-weight:800;color:var(--text);letter-spacing:0.5px;display:block;margin-bottom:4px}
    .logo-sub{color:var(--text-muted);font-size:0.875rem}
    .card{background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);padding:32px;border:1px solid var(--border)}
    .google-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:0.875rem;font-weight:500;text-decoration:none;margin-bottom:20px;transition:all 0.15s;cursor:pointer;min-height:44px}
    .google-btn:hover{background:var(--bg);border-color:#94a3b8;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
    .google-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .divider{display:flex;align-items:center;gap:12px;margin-bottom:20px}
    .divider-line{flex:1;height:1px;background:var(--border)}
    .divider-text{font-size:0.75rem;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px}
    .field{margin-bottom:18px}
    label{display:block;font-size:0.8125rem;font-weight:600;color:var(--text);margin-bottom:6px}
    input[type=email],input[type=password]{width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:8px;font-size:0.9rem;outline:none;transition:border-color 0.15s,box-shadow 0.15s;background:var(--surface);color:var(--text);min-height:44px}
    input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
    input::placeholder{color:var(--text-muted)}
    .forgot{text-align:right;margin-bottom:22px}
    .forgot a{font-size:0.8125rem;color:var(--accent);text-decoration:none;font-weight:500}
    .forgot a:hover{text-decoration:underline}
    .submit-btn{width:100%;padding:12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:0.9375rem;font-weight:600;cursor:pointer;transition:all 0.15s;min-height:46px;position:relative}
    .submit-btn:hover:not(:disabled){background:var(--primary-hover);box-shadow:0 4px 12px rgba(4,20,31,0.2)}
    .submit-btn:active:not(:disabled){transform:translateY(1px)}
    .submit-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .submit-btn:disabled{opacity:0.65;cursor:not-allowed}
    .err{background:var(--danger-bg);border:1px solid var(--danger-border);color:var(--danger);padding:11px 14px;border-radius:8px;margin-bottom:18px;font-size:0.875rem;display:flex;align-items:flex-start;gap:8px;line-height:1.4}
    @keyframes fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .err{animation:fade-in 0.2s ease}
  </style>
</head>
<body>
  <main id="main-content" aria-label="Sign in">
  <div class="wrap">
    <div class="logo">
      <div class="logo-mark"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.75" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
      <span class="logo-text">Moonlanding</span>
      <div class="logo-sub">Sign in to your account</div>
    </div>
    <div class="card">
      <div id="err-area" role="alert" aria-live="assertive"></div>
      ${showGoogleAuth ? `<div id="google-area">
        <a href="/api/auth/google" class="google-btn" aria-label="Sign in with Google">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </a>
        <div class="divider"><div class="divider-line"></div><span class="divider-text">or</span><div class="divider-line"></div></div>
      </div>` : ''}
      <form id="loginForm" novalidate>
        <div class="field">
          <label for="email">Email address</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email" autofocus>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="Your password" required autocomplete="current-password">
        </div>
        <div class="forgot"><a href="/password-reset">Forgot password?</a></div>
        <button type="submit" id="submitBtn" class="submit-btn">Sign In</button>
      </form>
    </div>
  </div>
  </main>
  <script src="/ui/event-delegation.js"></script>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      var btn = document.getElementById('submitBtn');
      var errArea = document.getElementById('err-area');
      btn.textContent = 'Signing in\u2026';
      btn.disabled = true;
      errArea.innerHTML = '';
      try {
        var res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value })
        });
        var data = await res.json().catch(function() { return {}; });
        if (res.ok) {
          btn.textContent = 'Redirecting\u2026';
          window.location.href = data.redirect || '/';
        } else {
          errArea.innerHTML = '<div class="err"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span></span></div>';
          errArea.querySelector('span').textContent = data.error || 'Login failed. Please check your credentials.';
          btn.textContent = 'Sign In';
          btn.disabled = false;
        }
      } catch(err) {
        errArea.innerHTML = '<div class="err">Network error. Please try again.</div>';
        btn.textContent = 'Sign In';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
