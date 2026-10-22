'use strict';
// No account, API key, paid fallback, analytics, or remote prompt logging in this app.
const $ = id => document.getElementById(id);
const MODEL = 'https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf';
const CDN = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/';
let busy = false, controller = null, engine = null, ready = false, text = '', runId = 0, nextOnlineAt = 0;
window.JESP_AI_BOOTED = true;

function status(message, kind = '') {
  $('status').textContent = message;
  $('status').className = kind;
}
function updateUI() {
  for (const id of ['run', 'test', 'mode', 'budget', 'language', 'prompt', 'clearCache']) $(id).disabled = busy;
  $('cancel').disabled = !busy || !controller || controller.signal.aborted;
  $('run').textContent = $('mode').value === 'local' && !ready ? 'Hämta modellen och fråga AI' : 'Fråga AI gratis';
  $('badge').textContent = $('mode').value === 'online' ? 'Utan konto · online' : ready ? 'Lokal modell laddad' : 'Lokalt · inget konto';
  $('copy').disabled = $('save').disabled = !text || busy;
}
function abortError(signal) { return signal.reason || new DOMException('Avbrutet', 'AbortError'); }
function checkAbort(signal) { if (signal.aborted) throw abortError(signal); }
async function bounded(work, parent, ms) {
  checkAbort(parent);
  const child = new AbortController();
  const forward = () => child.abort(abortError(parent));
  parent.addEventListener('abort', forward, {once:true});
  const timer = setTimeout(() => child.abort(new DOMException('Tidsgränsen nåddes.', 'TimeoutError')), ms);
  let cancel;
  const cancelled = new Promise((_, reject) => {
    cancel = () => reject(abortError(child.signal));
    child.signal.addEventListener('abort', cancel, {once:true});
  });
  try { return await Promise.race([Promise.resolve().then(() => work(child.signal)), cancelled]); }
  finally { clearTimeout(timer); parent.removeEventListener('abort', forward); child.signal.removeEventListener('abort', cancel); }
}
function systemPrompt(language) {
  return language === 'sv' ? 'Svara på svenska om användaren inte ber om ett annat språk. Var hjälpsam, tydlig och kortfattad. Säg till när du är osäker. Du har ingen webbsökning.' : 'Be helpful, clear and concise. Answer in English unless asked otherwise. Acknowledge uncertainty. You have no web search.';
}
function extractText(data) {
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Tjänsten returnerade ett fel.');
  const content = data?.choices?.[0]?.message?.content;
  const value = Array.isArray(content) ? content.filter(p => p.type === 'text').map(p => p.text).join('\n') : content;
  if (typeof value !== 'string' || !value.trim()) throw new Error('AI-tjänsten returnerade inget läsbart svar.');
  return value.trim();
}
function pause(ms, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener('abort', stop); resolve(); };
    const timer = setTimeout(finish, ms);
    const stop = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); reject(abortError(signal)); };
    signal.addEventListener('abort', stop, {once:true});
  });
}
async function onlineAnswer(question, language, budget, signal) {
  while (Date.now() < nextOnlineAt) {
    status(`Gratisintervallet: nästa fråga skickas om ${Math.ceil((nextOnlineAt-Date.now())/1000)} s. Du kan avbryta.`);
    await pause(Math.min(1000, nextOnlineAt-Date.now()), signal);
  }
  checkAbort(signal);
  return bounded(async child => {
    status('Frågar Pollinations utan konto eller API-nyckel…');
    nextOnlineAt = Date.now() + 31000;
    const response = await fetch('https://text.pollinations.ai/openai', {
      method:'POST', credentials:'omit', referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json'}, signal:child,
      body:JSON.stringify({model:'openai', messages:[{role:'system',content:systemPrompt(language)},{role:'user',content:question}], max_tokens:budget, temperature:0.4, stream:false})
    });
    // The anonymous service currently allows one reply per 30 seconds per IP.
    // Respect this interval instead of bypassing it or switching to a paid API.
    nextOnlineAt = Date.now() + 31000;
    if (!response.ok) {
      const raw = await response.text();
      const err = new Error(`Pollinations HTTP ${response.status}: ${raw.slice(0,500)}`);
      err.status = response.status;
      let payload; try { payload = JSON.parse(raw); } catch {}
      err.freeLimit = payload?.error?.code === 'FREE_LIMIT';
      const header = response.headers.get('Retry-After');
      const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header)-Date.now())/1000) : Number(raw.match(/Retry after\s+(\d+)s/i)?.[1]);
      err.retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.max(31,seconds+1) : 31;
      if (err.freeLimit || err.status === 429) nextOnlineAt = Date.now() + err.retryAfter*1000;
      throw err;
    }
    const data = await response.json();
    return {text:extractText(data), model:typeof data.model === 'string' ? data.model : 'openai (alias)', finish:data.choices[0].finish_reason};
  }, signal, 90000);
}
async function getEngine(signal) {
  if (engine) return engine;
  if (!window.isSecureContext) throw new Error('Lokalt läge kräver HTTPS eller localhost.');
  if (!window.WebAssembly || !navigator.storage?.getDirectory) throw new Error('WebAssembly eller lokal lagring saknas i webbläsaren.');
  status('Hämtar den lokala AI-motorn…');
  const {Wllama} = await bounded(() => import(CDN + 'index.js'), signal, 30000);
  checkAbort(signal);
  engine = new Wllama({default:CDN + 'wasm/wllama.wasm'}, {suppressNativeLog:true,logger:{debug(){},log(){},warn(){},error:console.error}});
  return engine;
}
async function localAnswer(question, language, budget, signal, id) {
  const current = await getEngine(signal);
  if (!ready) {
    $('download').hidden = false;
    $('download').value = 0;
    status('Hämtar modellen, cirka 400 MB. Behåll fliken öppen…');
    try {
      await bounded(async child => {
        await current.loadModelFromUrl(MODEL, {
          n_ctx:4096, n_parallel:1, n_threads:1, n_batch:128, n_gpu_layers:0, signal:child,
          progressCallback:({loaded,total}) => {
            if (child.aborted || id !== runId) return;
            const pct = total > 0 ? Math.min(100, Math.round(100*loaded/total)) : 0;
            $('download').value = pct;
            status(pct >= 100 ? 'Startar modellen på din enhet…' : `Hämtar modell: ${pct}% · ${Math.round(loaded/1e6)} MB`);
          }
        });
        if (child.aborted) { await current.exit().catch(() => {}); throw abortError(child); }
      }, signal, 600000);
      checkAbort(signal);
      ready = true;
    } catch (error) {
      engine = null; ready = false;
      Promise.resolve(current.exit()).catch(() => {});
      throw error;
    } finally { $('download').hidden = true; }
  }
  status('AI:n skriver på din enhet. Behåll fliken öppen…');
  let resultText = '', finish;
  await bounded(async child => {
    const stream = await current.createChatCompletion({
      messages:[{role:'system',content:systemPrompt(language)},{role:'user',content:question}],
      max_tokens:budget, temperature:0.3, stream:true, abortSignal:child
    });
    for await (const chunk of stream) {
      checkAbort(child);
      const choice = chunk.choices?.[0];
      if (typeof choice?.delta?.content === 'string') resultText += choice.delta.content;
      if (choice?.finish_reason) finish = choice.finish_reason;
      if (id === runId) { text = resultText; $('answer').textContent = resultText; }
    }
  }, signal, 600000);
  if (!resultText.trim()) throw new Error('Den lokala modellen gav inget läsbart svar.');
  return {text:resultText.trim(), model:'Qwen2.5 0.5B · på din enhet', finish};
}
function explain(error, mode) {
  if (error.name === 'AbortError') return 'Avbrutet. Inga fler anrop skickas.';
  if (error.name === 'TimeoutError') return 'Tidsgränsen nåddes. Försök med en kortare fråga. Online-tjänsten kan vara upptagen.';
  if (error.freeLimit) return `Gratisgränsen är ett svar per 30 sekunder och IP-adress. Nästa fråga väntar vid behov ${error.retryAfter} s. Du behöver inte köpa något eller logga in.`;
  if (error.status === 429) return 'Pollinations har nått en trafikgräns. Försök senare eller välj lokalt läge. Appen använder ingen betald reserv.';
  if (error.status === 401 || error.status === 403) return 'Pollinations nekar det anonyma anropet just nu. Ingen inloggning öppnas. Du kan välja lokalt läge i inställningarna.';
  if (error.status >= 500) return 'Pollinations har ett serverfel. Försök senare eller välj lokalt läge.';
  if (/memory|alloc|out of bounds/i.test(error.message)) return 'Enheten har inte tillräckligt med minne för den lokala modellen. Stäng andra flikar eller använd online-läget.';
  if (/quota|storage|disk/i.test(error.message)) return 'Webbläsaren kan inte lagra modellen. Kontrollera ledigt utrymme och att privat läge inte blockerar lagring.';
  if (/context|kv_cache|too long/i.test(error.message)) return 'Frågan är för lång för modellen. Korta den och försök igen.';
  if (mode === 'online' && error instanceof TypeError) return 'Anropet kunde inte nå Pollinations. Nätverksfel, CORS eller ett tillägg kan blockera tjänsten. Inget betalalternativ används.';
  return error.message || String(error);
}
async function run(test = false) {
  if (busy) return;
  const mode = $('mode').value;
  const question = test ? 'Vad är 7 plus 5? Svara endast med talet.' : $('prompt').value.trim();
  if (!question) { status('Skriv en fråga först.'); $('prompt').focus(); return; }
  if (question.length > (mode === 'local' ? 4000 : 12000)) {status(`Korta frågan till högst ${mode === 'local' ? '4 000' : '12 000'} tecken.`, 'error');return;}
  const id = ++runId;
  controller = new AbortController();
  const active = controller;
  busy = true; text = '';
  $('result').hidden = false; $('answer').textContent = '';
  $('answerMeta').textContent = mode === 'online' ? 'Pollinations · online' : 'Lokal Qwen';
  $('answerNote').textContent = '';
  $('errorDetails').hidden = true;
  updateUI();
  const started = performance.now();
  try {
    const budget = test ? 64 : Number($('budget').value);
    const language = $('language').value;
    const answer = mode === 'online' ? await onlineAnswer(question,language,budget,active.signal) : await localAnswer(question,language,budget,active.signal,id);
    checkAbort(active.signal);
    text = answer.text;
    $('answer').textContent = text;
    $('answerMeta').textContent = `${answer.model} · ${((performance.now()-started)/1000).toFixed(1)} s`;
    $('answerNote').textContent = answer.finish === 'length' ? 'Svarslängdsgränsen nåddes; svaret kan vara avklippt.' : 'AI-genererat svar. Kontrollera viktiga uppgifter.';
    status(test ? 'Ett riktigt AI-svar kom tillbaka. Resultatet visas nedan.' : 'Klart.', 'success');
  } catch (error) {
    status(explain(error,mode), error.name === 'AbortError' ? '' : 'error');
    $('answerNote').textContent = text ? 'Ofullständigt svar: körningen avbröts eller misslyckades.' : 'Inget AI-svar mottogs.';
    if (error.name !== 'AbortError') { $('errorDetails').hidden = false; $('diagnostic').textContent = String(error.message || error).slice(0,1000); }
  } finally {
    busy = false; controller = null; $('download').hidden = true; updateUI();
  }
}
$('run').addEventListener('click', () => run());
$('test').addEventListener('click', () => run(true));
$('cancel').addEventListener('click', () => {controller?.abort(new DOMException('Avbrutet av användaren.', 'AbortError'));status('Avbryter…');updateUI();});
$('prompt').addEventListener('keydown', e => {if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){e.preventDefault();run();}});
$('mode').addEventListener('change', () => {
  $('modeNote').textContent = $('mode').value === 'local' ? 'Cirka 400 MB hämtas vid första lokala starten. Mindre modell; använder enhetens minne och batteri. Frågan lämnar inte enheten.' : 'Frågan skickas till Pollinations. Tjänstens kvoter gäller. Inga betalmodeller eller konto används.';
  status('Redo.');updateUI();
});
$('copy').addEventListener('click', async () => {try{await navigator.clipboard.writeText(text);status('Svaret är kopierat.','success');}catch{status('Urklipp blockerades. Markera och kopiera svaret manuellt.','error');}});
$('save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='JESP_AI_svar.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('clearCache').addEventListener('click', async () => {
  if (busy) return;
  busy = true; updateUI();
  const ctl = new AbortController();
  try {
    status('Raderar den lokala modellcachen…');
    const current = await getEngine(ctl.signal);
    if (ready) await current.exit();
    ready = false; engine = null;
    await current.cacheManager.clear();
    status('Den lokala modellcachen är raderad.','success');
  } catch(error) {status(explain(error,'local'),'error');}
  finally {busy=false;updateUI();}
});
updateUI();
