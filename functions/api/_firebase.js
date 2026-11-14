// Server-only Firebase service-account authentication. Never expose credentials to browsers.
const project = 'baptistcitychurch-4491f';
const enc = new TextEncoder();
function b64url(data){return btoa(String.fromCharCode(...new Uint8Array(data))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function json64(obj){return b64url(enc.encode(JSON.stringify(obj)));}
let cachedToken, expires=0;
export async function token(env){
  if(cachedToken && Date.now()<expires-60000)return cachedToken;
  if(!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)throw new Error('Server Firebase credentials are not configured');
  const keyPem=env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n');
  const raw=Uint8Array.from(atob(keyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',raw,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const payload={iss:env.FIREBASE_CLIENT_EMAIL,sub:env.FIREBASE_CLIENT_EMAIL,aud:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/datastore',iat:now,exp:now+3500};
  const head=json64({alg:'RS256',typ:'JWT'}),body=json64(payload);
  const signature=b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(head+'.'+body)));
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:head+'.'+body+'.'+signature})});
  if(!res.ok)throw new Error('Firebase service authentication failed');
  const result=await res.json();cachedToken=result.access_token;expires=Date.now()+result.expires_in*1000;return cachedToken;
}
export const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
export function reply(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function str(value){return {stringValue:String(value)};}
export function int(value){return {integerValue:String(value)};}
export function field(doc,key){return doc?.fields?.[key]?.stringValue || '';}
export function idOf(doc){return doc.name?.split('/').pop() || '';}
export async function firestore(env,url,options={}){const access=await token(env);return fetch(url,{...options,headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json',...(options.headers||{})}});}
export async function loadMembers(env){
  const res=await firestore(env,base+':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{from:[{collectionId:'members'}],limit:3000}})});
  if(!res.ok)throw new Error('Unable to load attendee directory');
  const rows=await res.json();return rows.map(r=>r.document).filter(Boolean);
}
export function sameOrigin(request){const origin=request.headers.get('Origin');return !origin || origin===new URL(request.url).origin;}
