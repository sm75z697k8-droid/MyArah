/**
 * MyArah natural English voice proxy for Cloudflare Workers.
 * Keep AZURE_SPEECH_KEY in Worker Secrets, NEVER in the public GitHub repo.
 * Worker settings:
 *   ALLOWED_ORIGIN      https://YOUR-USERNAME.github.io  (no trailing slash)
 *   AZURE_SPEECH_REGION southeastasia  (use YOUR Azure Speech resource region)
 *   AZURE_SPEECH_KEY    <secret, set in Cloudflare dashboard>
 *   AZURE_VOICE_NAME    en-GB-SoniaNeural (optional; en-GB-RyanNeural, en-US-JennyNeural)
 *
 * CORS/Origin checks are NOT authentication. Add Cloudflare rate-limiting and
 * monitor Azure billing/quotas if the endpoint is exposed to the public.
 */
const VOICES = new Set(['en-GB-SoniaNeural','en-GB-RyanNeural','en-US-JennyNeural']);
const OUTPUT_FORMAT = 'audio-16khz-32kbitrate-mono-mp3';
const MAX_LENGTH = 220;
const encoder = new TextEncoder();
const escapeXML = value => value.replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
})[char]);
function reply(message, status, cors) {
  return new Response(message, {
    status,headers:{...cors,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}
  });
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const origin=request.headers.get('Origin') || '';
    const configured=String(env.ALLOWED_ORIGIN || '').replace(/\/$/,'');
    const allow=Boolean(configured) && origin===configured;
    const cors=allow?{
      'Access-Control-Allow-Origin':configured,
      'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
      'Vary':'Origin'
    }:{};
    if(url.pathname!=='/tts')return reply('Not found',404,cors);
    if(request.method==='OPTIONS')return allow?new Response(null,{status:204,headers:cors}):reply('Forbidden',403,{});
    if(request.method!=='POST')return reply('Method not allowed',405,cors);
    if(!allow)return reply('Forbidden origin',403,{});
    const region=String(env.AZURE_SPEECH_REGION||'').trim().toLowerCase();
    const voice=String(env.AZURE_VOICE_NAME||'en-GB-SoniaNeural');
    if(!env.AZURE_SPEECH_KEY || !/^[a-z][a-z0-9]{2,25}$/.test(region) || !VOICES.has(voice)){
      return reply('Speech service is not configured',503,cors);
    }
    if(Number(request.headers.get('Content-Length')||0)>600)return reply('Request too long',413,cors);
    let text;
    try{
      const data=await request.json();
      text=typeof data?.text==='string'?data.text.trim():'';
    }catch(_){return reply('Invalid JSON',400,cors);}
    if(!text || text.length>MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(text)){
      return reply('Invalid text',400,cors);
    }
    // Use a fixed, safe voice. Incoming requests cannot inject arbitrary SSML.
    const ssml=`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="${voice}">${escapeXML(text)}</voice></speak>`;
    const fingerprint=await crypto.subtle.digest('SHA-256',encoder.encode(region+'|'+voice+'|'+text));
    const hash=Array.from(new Uint8Array(fingerprint),b=>b.toString(16).padStart(2,'0')).join('');
    const cacheKey=new Request(new URL('/_cached-tts/'+hash,url.origin).toString());
    const cache=caches?.default;
    if(cache){
      const hit=await cache.match(cacheKey);
      if(hit)return new Response(hit.body,{status:200,headers:{...cors,
        'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
    }
    let upstream;
    try{
      const abort=new AbortController();
      const watchdog=setTimeout(()=>abort.abort(),6200);
      try{
        upstream=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{
          method:'POST',signal:abort.signal,
          headers:{
            'Ocp-Apim-Subscription-Key':env.AZURE_SPEECH_KEY,
            'Content-Type':'application/ssml+xml',
            'X-Microsoft-OutputFormat':OUTPUT_FORMAT,
            'User-Agent':'MyArah-Navigation-Voice'
          },body:ssml
        });
      }finally{clearTimeout(watchdog);}
    }catch(_){return reply('Speech service timed out',504,cors);}
    if(!upstream.ok)return reply('Speech service unavailable',502,cors);
    const bytes=await upstream.arrayBuffer();
    if(bytes.byteLength<100 || bytes.byteLength>750000)return reply('Invalid audio returned',502,cors);
    const result=new Response(bytes,{status:200,headers:{...cors,
      'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    if(cache && ctx?.waitUntil){
      const cachedResponse=new Response(bytes,{headers:{
        'Content-Type':'audio/mpeg','Cache-Control':'public, max-age=604800'
      }});
      ctx.waitUntil(cache.put(cacheKey,cachedResponse).catch(()=>{}));
    }
    return result;
  }
};
