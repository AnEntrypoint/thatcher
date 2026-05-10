// Defensive JSON fetcher for client-side scripts. Loud-fail when an endpoint
// returns non-JSON (almost always: a 302 -> /login HTML redirect, a 404 HTML
// page, or an unrouted path falling through to the catch-all). Throws an Error
// whose message identifies the URL, status, and observed content-type so the
// failure can be triaged from the console rather than the cryptic
// "Unexpected token '<', '<!DOCTYPE '... is not valid JSON" SyntaxError.
//
// This module is server-rendered as an inline string so client scripts can
// reference window.fetchJson without an import statement.

export const FETCH_JSON_SCRIPT = `window.fetchJson=async function(url,opts){
var o=Object.assign({credentials:'include',headers:{}},opts||{});
o.headers=Object.assign({'accept':'application/json'},o.headers||{});
var r=await fetch(url,o);
var ct=(r.headers.get('content-type')||'').split(';')[0].trim();
if(!ct.includes('json')){
  var body=await r.text();
  var snippet=body.slice(0,80).replace(/\\s+/g,' ');
  throw new Error('fetchJson('+url+') expected JSON, got '+(ct||'(none)')+' status='+r.status+' body~='+snippet);
}
var data=await r.json();
if(!r.ok){var err=new Error((data&&(data.error||data.message))||('fetchJson('+url+') status='+r.status));err.status=r.status;err.data=data;throw err;}
return data;
};`;
