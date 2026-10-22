"""Offline UI fault-injection tests; these do NOT validate an AI service."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 def page_for(status=200,text='Ett svar',delay=False,free_limit=False):
  page=browser.new_page(viewport={'width':390,'height':844}); page.set_default_timeout(3000)
  calls=[]
  page.expose_function('recordRequest',lambda url,opts:calls.append({'url':url,**opts}))
  mock = """
  window.fetch = (url, options={}) => {
    window.recordRequest(String(url),{method:options.method,headers:options.headers,credentials:options.credentials});
    return new Promise((resolve,reject)=>{
      const abort=()=>reject(options.signal.reason || new DOMException('Aborted','AbortError'));
      if(options.signal?.aborted){abort();return;}
      if(TEST_DELAY) {options.signal?.addEventListener('abort',abort,{once:true});return;}
      resolve(new Response(JSON.stringify(TEST_PAYLOAD),{status:TEST_STATUS,headers:{'Content-Type':'application/json'}}));
    });
  };
  """.replace('TEST_DELAY',json.dumps(delay)).replace('TEST_PAYLOAD',json.dumps({'error':{'code':'FREE_LIMIT','message':'Retry after 25s'}} if free_limit else {'choices':[{'message':{'content':text},'finish_reason':'stop'}]})).replace('TEST_STATUS',str(status))
  html=(ROOT/'index.html').read_text().replace('<script type="module" src="./ai.js?v=4.0"></script>','<script>'+mock+'</script><script type="module">'+(ROOT/'ai.js').read_text()+'</script>')
  page.set_content(html);page.wait_for_function('window.JESP_AI_BOOTED')
  return page,calls
 page,calls=page_for();page.click('#run');assert not calls;checks.append('empty prompt makes no request');page.close()
 page,calls=page_for(text='<img src=x onerror=alert(1)>');page.fill('#prompt','Test');page.click('#run');page.wait_for_function("!document.getElementById('run').disabled");assert page.locator('#answer img').count()==0;assert '<img' in page.locator('#answer').inner_text();assert len(calls)==1;assert 'authorization' not in calls[0]['headers'];checks.append('success, no credentials, model HTML rendered as text');page.close()
 page,calls=page_for(status=402,free_limit=True);page.fill('#prompt','Test');page.click('#run');page.wait_for_function("!document.getElementById('run').disabled");assert '30 sekunder' in page.locator('#status').inner_text();assert len(calls)==1;checks.append('HTTP 402 FREE_LIMIT explains free interval without a paid fallback');page.close()
 page,calls=page_for();page.fill('#prompt','Test');page.click('#run');page.wait_for_function("!document.getElementById('run').disabled");page.click('#run');page.wait_for_function("document.getElementById('status').textContent.includes('Gratisintervallet')");assert len(calls)==1;page.click('#cancel');page.wait_for_function("!document.getElementById('run').disabled");assert len(calls)==1;checks.append('second question waits for free interval; cancellation sends nothing');page.close()
 for code in (401,429,503):
  page,calls=page_for(status=code);page.fill('#prompt','Test');page.click('#run');page.wait_for_function("!document.getElementById('run').disabled");assert 'error' in page.locator('#status').get_attribute('class');assert len(calls)==1;assert page.locator('#mode').input_value()=='online';checks.append(f'HTTP {code}: no retry, no login, no local auto-download');page.close()
 page,calls=page_for(delay=True);page.fill('#prompt','Test');page.click('#run');page.wait_for_function("document.getElementById('run').disabled");page.click('#cancel');page.wait_for_function("!document.getElementById('run').disabled");assert 'Avbrutet' in page.locator('#status').inner_text();checks.append('cancel releases UI');page.close()
 page,calls=page_for();page.locator('details.card summary').click();page.select_option('#mode','local');assert not calls;assert '400 MB' in page.locator('#modeNote').inner_text();assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');checks.append('local mode is opt-in and mobile has no overflow');page.screenshot(path=str(ROOT/'mobile-preview.png'),full_page=True);page.close()
 browser.close()
(ROOT/'ui-test-results.json').write_text(json.dumps({'mockedAI':True,'checks':checks},ensure_ascii=False,indent=2));print(json.dumps(checks,ensure_ascii=False,indent=2))
