import { generateHtml } from '@/ui/layout.js'
import { nav as navFn } from '@/ui/layout.js'
import { AUTH_CSS, GOOGLE_SVG, WARN_SVG, LOGO_SVG, authLogoHtml } from '@/ui/auth-styles.js'

export function renderLogin(error = null, hasGoogleAuth = false) {
  const errHtml = error
    ? `<div class="auth-err" role="alert">${WARN_SVG}${String(error).replace(/</g, '&lt;')}</div>`
    : ''
  const googleBtn = hasGoogleAuth
    ? `<a href="/api/auth/google" class="auth-google-btn" aria-label="Continue with Google">${GOOGLE_SVG}Continue with Google</a>
       <div class="auth-divider"><div class="auth-divider-line"></div><span class="auth-divider-text">or</span><div class="auth-divider-line"></div></div>`
    : ''
  const body = `${AUTH_CSS}
  <div class="auth-shell"><div class="auth-wrap">
    ${authLogoHtml('Sign in to your account')}
    <div class="auth-card">
      <div id="login-err-area" role="alert" aria-live="assertive">${errHtml}</div>
      ${googleBtn}
      <form id="login-form" aria-label="Sign in" novalidate>
        <div class="auth-field"><label class="auth-label" for="email">Email address</label>
          <input type="email" name="email" id="email" class="auth-input" placeholder="you@example.com" required autocomplete="email" autofocus></div>
        <div class="auth-field"><label class="auth-label" for="password">Password</label>
          <input type="password" name="password" id="password" class="auth-input" placeholder="Your password" required autocomplete="current-password"></div>
        <div class="auth-forgot"><a href="/password-reset">Forgot password?</a></div>
        <button type="submit" id="login-btn" class="auth-submit">Sign In</button>
      </form>
    </div>
  </div></div>`
  const script = `
var form=document.getElementById('login-form');
form.addEventListener('submit',async function(e){
  e.preventDefault();var btn=document.getElementById('login-btn'),errArea=document.getElementById('login-err-area');
  btn.textContent='Signing in\u2026';btn.disabled=true;errArea.innerHTML='';
  try{var res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value})});
    var data=await res.json().catch(function(){return{};});
    if(res.ok){btn.textContent='Redirecting\u2026';window.location.href=data.redirect||'/';}
    else{var el=document.createElement('div');el.className='auth-err';el.setAttribute('role','alert');el.textContent=data.error||'Login failed. Please check your credentials.';errArea.innerHTML='';errArea.appendChild(el);btn.textContent='Sign In';btn.disabled=false;}
  }catch(err){errArea.innerHTML='<div class="auth-err" role="alert">Network error. Please try again.</div>';btn.textContent='Sign In';btn.disabled=false;}
});`
  return generateHtml('Sign In | Moonlanding', body, [script])
}

export function renderPasswordReset() {
  const body = `${AUTH_CSS}
  <div class="auth-shell"><div class="auth-wrap">
    ${authLogoHtml('Reset your password')}
    <div class="auth-card">
      <div id="reset-success" class="auth-success" style="display:none" role="alert">If an account exists with that email, a reset link has been sent. Check your inbox.</div>
      <form id="reset-form" aria-label="Password reset request" novalidate>
        <div class="auth-field"><label class="auth-label" for="email">Email address</label>
          <input type="email" name="email" id="email" class="auth-input" placeholder="you@example.com" required autocomplete="email" autofocus></div>
        <div id="reset-err-area" role="alert" aria-live="assertive"></div>
        <button type="submit" id="reset-btn" class="auth-submit">Send Reset Link</button>
      </form>
      <div class="auth-back"><a href="/login">Back to sign in</a></div>
    </div>
  </div></div>`
  const script = `
var form=document.getElementById('reset-form');
form.addEventListener('submit',async function(e){
  e.preventDefault();var btn=document.getElementById('reset-btn'),errArea=document.getElementById('reset-err-area');
  btn.textContent='Sending\u2026';btn.disabled=true;errArea.innerHTML='';
  try{var res=await fetch('/api/auth/password-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value})});
    if(res.ok){form.style.display='none';document.getElementById('reset-success').style.display='block';}
    else{var d=await res.json().catch(function(){return{};});var el=document.createElement('div');el.className='auth-err';el.setAttribute('role','alert');el.textContent=d.error||'Request failed. Please try again.';errArea.innerHTML='';errArea.appendChild(el);btn.textContent='Send Reset Link';btn.disabled=false;}
  }catch(err){errArea.innerHTML='<div class="auth-err" role="alert">Network error. Please try again.</div>';btn.textContent='Send Reset Link';btn.disabled=false;}
});`
  return generateHtml('Reset Password | Moonlanding', body, [script])
}

export function renderPasswordResetConfirm(token) {
  const body = `${AUTH_CSS}
  <div class="auth-shell"><div class="auth-wrap">
    ${authLogoHtml('Set a new password')}
    <div class="auth-card">
      <div id="confirm-success" class="auth-success" style="display:none" role="alert">Password updated. <a href="/login" style="color:#15803d;text-decoration:underline;font-weight:600">Sign in now</a></div>
      <form id="confirm-form" aria-label="Set new password" novalidate>
        <input type="hidden" name="token" value="${token}">
        <div class="auth-field"><label class="auth-label" for="password">New password</label>
          <input type="password" name="password" id="password" class="auth-input" placeholder="At least 8 characters" minlength="8" required autocomplete="new-password" autofocus></div>
        <div class="auth-field"><label class="auth-label" for="confirm_password">Confirm new password</label>
          <input type="password" name="confirm_password" id="confirm_password" class="auth-input" placeholder="Same password again" minlength="8" required autocomplete="new-password"></div>
        <div id="confirm-err-area" role="alert" aria-live="assertive"></div>
        <button type="submit" id="confirm-btn" class="auth-submit">Update Password</button>
      </form>
      <div class="auth-back"><a href="/login">Back to sign in</a></div>
    </div>
  </div></div>`
  const script = `
var form=document.getElementById('confirm-form');
form.addEventListener('submit',async function(e){
  e.preventDefault();var pw=form.password.value,cpw=form.confirm_password.value,errArea=document.getElementById('confirm-err-area');
  errArea.innerHTML='';
  if(pw!==cpw){errArea.innerHTML='<div class="auth-err" role="alert">Passwords do not match.</div>';return;}
  var btn=document.getElementById('confirm-btn');btn.textContent='Updating\u2026';btn.disabled=true;
  try{var res=await fetch('/api/auth/password-reset',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:form.token.value,password:pw})});
    var data=await res.json().catch(function(){return{};});
    if(res.ok){form.style.display='none';document.getElementById('confirm-success').style.display='block';}
    else{var el=document.createElement('div');el.className='auth-err';el.setAttribute('role','alert');el.textContent=data.error||'Reset failed. Please try again.';errArea.innerHTML='';errArea.appendChild(el);btn.textContent='Update Password';btn.disabled=false;}
  }catch(err){errArea.innerHTML='<div class="auth-err" role="alert">Network error. Please try again.</div>';btn.textContent='Update Password';btn.disabled=false;}
});`
  return generateHtml('Set New Password | Moonlanding', body, [script])
}

export function renderAccessDenied(user, entityName, action) {
  const txt = { list: 'view this list', view: 'view this item', create: 'create items here', edit: 'edit this item', delete: 'delete this item' }
  const body = `<div class="min-h-screen">${navFn(user)}<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:40px 20px">
    <div style="font-size:48px;margin-bottom:16px" aria-hidden="true">&#128274;</div>
    <h1 style="font-size:24px;font-weight:700;color:var(--color-text,#0f172a);margin:0 0 8px">Access Denied</h1>
    <p style="color:var(--color-text-muted,#64748b);margin:0 0 24px;max-width:400px">You do not have permission to ${txt[action] || action} in ${entityName}.</p>
    <a href="/" class="btn-primary-clean">Return to Dashboard</a>
  </div></div>`
  return generateHtml('Access Denied | Moonlanding', body)
}
