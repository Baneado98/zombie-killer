// landing.ts — the human-facing web app (single self-contained page).
//
// It's a real interactive tool: paste your statement -> instantly see the
// recurring charges + zombie verdicts + estimated yearly savings (FREE), then
// unlock the full letter package (PAID, crypto). No build step, no framework.

export function LANDING_HTML(baseUrl: string, price: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>zombie-killer — kill the subscriptions draining your bank account</title>
<meta name="description" content="Paste your bank statement and instantly find the zombie subscriptions silently draining your money. Get ready-to-send letters to cancel them, renegotiate the bill down, or erase your data (GDPR/CCPA). Your data never leaves your browser unless you choose to scan.">
<meta name="keywords" content="cancel subscription letter, zombie subscription finder, recurring charges detector, GDPR data deletion request template, CCPA delete my data, renegotiate bill script, subscription audit, stop recurring payments">
<link rel="canonical" href="${baseUrl}/">
<meta property="og:title" content="zombie-killer — kill the subscriptions draining your bank account">
<meta property="og:description" content="Find forgotten subscriptions and get ready-to-send cancel / renegotiate / data-deletion letters. You send them.">
<meta property="og:type" content="website"><meta property="og:url" content="${baseUrl}/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"zombie-killer","applicationCategory":"FinanceApplication","operatingSystem":"Any","description":"Detect zombie subscriptions from your bank statement and generate ready-to-send cancellation, renegotiation and GDPR/CCPA data-deletion letters.","offers":{"@type":"Offer","price":"${price.replace("$","")}","priceCurrency":"USD"}}</script>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#0b0f17;color:#e6e9f0;line-height:1.55}
.wrap{max-width:820px;margin:0 auto;padding:40px 20px 90px}
.hero h1{font-size:2.5rem;line-height:1.1;margin:0 0 10px;color:#fff;letter-spacing:-.02em}
.hero h1 .z{color:#41e69d}
.sub{color:#9aa3b5;font-size:1.12rem;max-width:620px;margin:0 0 8px}
.badges{margin:18px 0 26px}
.badge{display:inline-block;background:#10271d;border:1px solid #1d4a36;border-radius:999px;padding:4px 13px;font-size:.8rem;color:#41e69d;margin:0 7px 8px 0}
.card{background:#10141f;border:1px solid #1c2433;border-radius:16px;padding:22px;margin:18px 0}
label{display:block;font-size:.85rem;color:#9aa3b5;margin:0 0 7px}
textarea{width:100%;min-height:150px;background:#0a0d14;border:1px solid #232c3d;border-radius:10px;color:#e6e9f0;padding:13px;font-family:ui-monospace,Menlo,monospace;font-size:.86rem;resize:vertical}
.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
input[type=text]{flex:1;min-width:150px;background:#0a0d14;border:1px solid #232c3d;border-radius:9px;color:#e6e9f0;padding:10px 12px;font-size:.9rem}
select{background:#0a0d14;border:1px solid #232c3d;border-radius:9px;color:#e6e9f0;padding:10px;font-size:.9rem}
button{background:#41e69d;color:#06281a;border:0;border-radius:10px;padding:13px 22px;font-size:1rem;font-weight:700;cursor:pointer}
button.ghost{background:transparent;color:#41e69d;border:1px solid #2c6a4c}
button:disabled{opacity:.5;cursor:default}
.tiny{font-size:.78rem;color:#6b7488}
.savings{font-size:2.1rem;font-weight:800;color:#41e69d;margin:4px 0}
.zlist{margin-top:8px}
.zitem{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid #1a2230}
.zitem .m{font-weight:600;color:#fff}
.zitem .cat{font-size:.78rem;color:#7a8398}
.tag{font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap;align-self:flex-start}
.tag.ZOMBIE{background:#3a1220;color:#ff7a9c}.tag.REVIEW{background:#3a2e10;color:#ffcf6b}.tag.ACTIVE{background:#13202c;color:#7fd4ff}
.amt{text-align:right;white-space:nowrap}.amt b{color:#fff}
h2{font-size:1.2rem;margin:30px 0 8px;color:#fff}
.steps{counter-reset:s;padding:0;list-style:none;margin:10px 0}
.steps li{counter-increment:s;padding:8px 0 8px 36px;position:relative;color:#c4cbda}
.steps li::before{content:counter(s);position:absolute;left:0;top:6px;width:24px;height:24px;border-radius:50%;background:#10271d;border:1px solid #1d4a36;color:#41e69d;font-size:.78rem;display:flex;align-items:center;justify-content:center;font-weight:700}
.letterblock{background:#0a0d14;border:1px solid #232c3d;border-radius:10px;padding:14px;margin:10px 0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:.8rem;color:#cbd3e2;max-height:340px;overflow:auto}
.lt-head{display:flex;justify-content:space-between;align-items:center;margin-top:14px}
.lt-head .t{font-weight:700;color:#fff}
a{color:#41e69d}
footer{margin-top:46px;color:#5b6474;font-size:.82rem;border-top:1px solid #1a2230;padding-top:18px}
.note{background:#10141f;border-left:3px solid #41e69d;padding:10px 14px;border-radius:0 8px 8px 0;font-size:.86rem;color:#9aa3b5;margin:14px 0}
.err{color:#ff7a9c;font-size:.86rem;margin-top:8px}
.hidden{display:none}
</style></head><body><div class="wrap">

<div class="hero">
  <h1><span class="z">zombie</span>-killer 🧟</h1>
  <p class="sub">Find the subscriptions silently draining your bank account — and get the exact letters to <b>cancel them</b>, <b>renegotiate the bill down</b>, or <b>erase your data</b>. You paste your statement; we detect the leaks and write the letters. <b>You send them.</b></p>
  <div class="badges">
    <span class="badge">free scan</span><span class="badge">cancel · renegotiate · GDPR/CCPA</span><span class="badge">pay in crypto</span><span class="badge">no account</span><span class="badge">we never contact the company for you</span>
  </div>
</div>

<div class="card">
  <label>Paste your bank/card statement, or your list of subscriptions. CSV or plain lines — one charge per line, with a date and an amount.</label>
  <textarea id="data" placeholder="2026-05-12, NETFLIX.COM, -12.99
2026-04-12, NETFLIX.COM, -12.99
2026-03-12, NETFLIX.COM, -11.99
2026-05-03, ADOBE *CREATIVE CLOUD, -59.99
2026-04-03, ADOBE *CREATIVE CLOUD, -59.99
2026-05-19, SPOTIFY P0A1B2, -9.99
2026-04-19, SPOTIFY P0A1B2, -9.99
2026-02-28, NORDVPN, -71.76"></textarea>
  <div class="row">
    <button id="scanBtn" onclick="doScan()">Find my zombie subscriptions →</button>
    <button class="ghost" onclick="loadDemo()">Use sample data</button>
  </div>
  <p class="tiny" style="margin-top:10px">Your statement is processed to detect recurring charges and is not stored. Don't include card numbers — we don't need them.</p>
  <div id="scanErr" class="err hidden"></div>
</div>

<div id="results" class="hidden"></div>

<div id="explain">
  <h2>How it works</h2>
  <ol class="steps">
    <li><b>Paste & scan (free).</b> We detect recurring charges, flag the <b>zombies</b> (forgotten, price-crept, free-trials-that-converted, hard-to-cancel), and total your yearly waste.</li>
    <li><b>Unlock your action pack (${price}, crypto).</b> For every charge you get three ready-to-send letters: a firm <b>cancellation</b>, a <b>renegotiation/retention</b> script to lower the bill, and a <b>GDPR (EU) / CCPA (US) data-deletion</b> request.</li>
    <li><b>You send them.</b> Each letter comes with where and how to send it. We never contact the company or act on your behalf.</li>
  </ol>
  <div class="note">Built for people and for AI agents. Agents can call the same engine over <a href="${baseUrl}/openapi.json">x402</a> or as an <a href="https://github.com/Baneado98/zombie-killer">MCP server</a>.</div>
</div>

<footer>
  zombie-killer drafts self-help letters; it is not a law firm and this is not legal advice. You send everything yourself from your own account. ·
  <a href="https://github.com/Baneado98/zombie-killer">Source (MIT)</a>
</footer>
</div>

<script>
const PRICE = ${JSON.stringify(price)};
const CUR = {USD:"$",EUR:"€",GBP:"£"};
function sym(c){return CUR[c]||"";}
let LAST_DATA = "";

function loadDemo(){
  document.getElementById('data').value =
\`2026-05-12, NETFLIX.COM, -12.99
2026-04-12, NETFLIX.COM, -12.99
2026-03-12, NETFLIX.COM, -11.99
2026-05-03, ADOBE *CREATIVE CLOUD, -59.99
2026-04-03, ADOBE *CREATIVE CLOUD, -59.99
2026-03-03, ADOBE *CREATIVE CLOUD, -59.99
2026-05-19, SPOTIFY P0A1B2, -9.99
2026-04-19, SPOTIFY P0A1B2, -9.99
2026-02-28, NORDVPN, -71.76
2026-05-06, AUDIBLE*MEMBERSHIP, -14.95
2026-04-06, AUDIBLE*MEMBERSHIP, -14.95
2026-05-01, PLANET FIT CLUB FEES, -24.99
2026-04-01, PLANET FIT CLUB FEES, -24.99\`;
}

async function doScan(){
  const data = document.getElementById('data').value.trim();
  const err = document.getElementById('scanErr');
  err.classList.add('hidden');
  if(!data){ err.textContent="Paste some statement lines first."; err.classList.remove('hidden'); return; }
  LAST_DATA = data;
  const btn = document.getElementById('scanBtn'); btn.disabled=true; btn.textContent="Scanning…";
  try{
    const r = await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data})});
    const j = await r.json();
    if(!r.ok){ throw new Error(j.error||'scan failed'); }
    render(j);
  }catch(e){ err.textContent=String(e.message||e); err.classList.remove('hidden'); }
  finally{ btn.disabled=false; btn.textContent="Find my zombie subscriptions →"; }
}

function render(j){
  document.getElementById('explain').classList.add('hidden');
  const s = sym(j.currency);
  const zlist = j.charges.map(c=>\`
    <div class="zitem">
      <div>
        <div class="m">\${c.merchant} <span class="tag \${c.verdict}">\${c.verdict}</span></div>
        <div class="cat">\${c.category} · \${c.cadence} · seen \${c.occurrences}×\${c.zombieReasons[0]?' · '+c.zombieReasons[0]:''}</div>
      </div>
      <div class="amt"><b>\${s}\${c.amountTypical.toFixed(2)}</b><div class="cat">\${s}\${c.annualizedCost.toFixed(2)}/yr</div></div>
    </div>\`).join('');

  const out = document.getElementById('results');
  out.classList.remove('hidden');
  out.innerHTML = \`
    <div class="card">
      <label>Estimated money you could stop wasting every year</label>
      <div class="savings">\${s}\${Number(j.estimatedZombieSavings).toFixed(2)}<span class="tiny" style="font-weight:400"> /year from \${j.zombieCount} zombie\${j.zombieCount===1?'':'s'}</span></div>
      <div class="tiny">\${j.recurringCount} recurring charges found · \${s}\${Number(j.totalAnnualizedRecurring).toFixed(2)}/yr in total recurring spend</div>
      <div class="zlist">\${zlist || '<p class="tiny">No recurring charges detected. Make sure each line has a date and an amount.</p>'}</div>
    </div>
    \${j.recurringCount>0?\`
    <div class="card">
      <h2 style="margin-top:4px">Get your action pack — \${PRICE}</h2>
      <p class="sub" style="font-size:.96rem">Three ready-to-send letters for every charge above: <b>cancel</b>, <b>renegotiate</b>, and <b>delete my data (GDPR/CCPA)</b>. Fill your details so they're ready to send:</p>
      <div class="row">
        <input type="text" id="fullName" placeholder="Your full name">
        <input type="text" id="email" placeholder="Email on your accounts">
      </div>
      <div class="row">
        <input type="text" id="accountId" placeholder="(optional) an account / member number">
        <select id="jurisdiction">
          <option value="eu">I'm in the EU (GDPR)</option>
          <option value="uk">UK (UK GDPR)</option>
          <option value="ca">California (CCPA/CPRA)</option>
          <option value="us">US (other)</option>
        </select>
      </div>
      <div class="row" style="margin-top:14px">
        <button onclick="payCrypto()">Pay \${PRICE} in crypto → unlock letters</button>
        <button class="ghost" onclick="previewOne()">Preview one free</button>
      </div>
      <div id="payErr" class="err hidden"></div>
      <p class="tiny" style="margin-top:10px">Pay in 300+ coins (USDC, USDT, BTC, ETH…). After payment the full pack appears here. AI agents can pay automatically via <a href="${baseUrl}/openapi.json">x402</a>.</p>
    </div>\`:''}
    <div id="pack"></div>
    <div id="preview"></div>
  \`;
  out.scrollIntoView({behavior:'smooth'});
}

function letterCard(L){
  return \`<div class="lt-head"><span class="t">\${L.type==='cancel'?'Cancellation':L.type==='renegotiate'?'Renegotiation script':'Data-deletion request'}</span>
    <button class="ghost" style="padding:6px 12px;font-size:.82rem" onclick="copyText(this)">Copy</button></div>
    <div class="tiny" style="margin:4px 0">How to send: \${L.channelHint||''}</div>
    <div class="letterblock">\${(L.body||'').replace(/</g,'&lt;')}</div>\`;
}
function copyText(btn){
  const block = btn.closest('.lt-head').nextElementSibling.nextElementSibling;
  navigator.clipboard.writeText(block.innerText).then(()=>{btn.textContent="Copied!";setTimeout(()=>btn.textContent="Copy",1500);});
}

async function previewOne(){
  // free teaser: build the package client-asks server for the FIRST charge's cancel letter via /pro? No —
  // we re-run scan then call a free render of one cancel letter through /api/scan data we already have.
  const prev = document.getElementById('preview');
  prev.innerHTML = '<div class="card"><p class="tiny">Loading a sample letter…</p></div>';
  try{
    // Use the public package endpoint in "demo" mode: we only show ONE letter as a teaser.
    const r = await fetch('/api/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:LAST_DATA})});
    const j = await r.json();
    const top = j.charges.find(c=>c.verdict!=='ACTIVE') || j.charges[0];
    if(!top){ prev.innerHTML=''; return; }
    // ask server to draft just the cancel letter for the top charge (free preview via /mcp-like path):
    const lr = await fetch('/api/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({merchant:top.merchant,amount:top.amountTypical,currency:top.currency,cadence:top.cadence,cancelHint:top.cancelHint})});
    const lj = await lr.json();
    prev.innerHTML = '<div class="card"><h2 style="margin-top:4px">Sample: cancellation letter for '+top.merchant+'</h2>'+letterCard(lj)+'<p class="tiny">This is one of '+(j.recurringCount*3)+' letters in your pack. Unlock the rest above.</p></div>';
  }catch(e){ prev.innerHTML='<div class="card"><p class="err">'+(e.message||e)+'</p></div>'; }
}

async function payCrypto(){
  const err = document.getElementById('payErr'); err.classList.add('hidden');
  try{
    const r = await fetch('/api/pay/nowpayments?order=zk-'+Date.now());
    const j = await r.json();
    if(!r.ok){ throw new Error(j.detail||j.error||'checkout unavailable'); }
    if(j.payUrl){ window.open(j.payUrl,'_blank'); pollPayment(j.invoiceId); }
    else throw new Error('No checkout URL returned.');
  }catch(e){
    err.innerHTML = String(e.message||e) + '<br><span class="tiny">Crypto checkout is being finalized. AI agents can already pay via the x402 endpoint. Human checkout goes live shortly.</span>';
    err.classList.remove('hidden');
  }
}
async function pollPayment(id){
  // best-effort: when NOWPayments confirms, unlock the pack
  for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r,5000));
    try{
      const r = await fetch('/api/package',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({data:LAST_DATA,paymentId:id,fullName:val('fullName'),email:val('email'),accountId:val('accountId'),jurisdiction:val('jurisdiction')})});
      if(r.ok){ const j=await r.json(); renderPack(j); return; }
    }catch(e){}
  }
}
function val(id){const el=document.getElementById(id);return el?el.value:'';}

function renderPack(j){
  const pack = document.getElementById('pack');
  const blocks = j.package.map(m=>\`<div class="card"><h2 style="margin-top:4px">\${m.merchant}</h2>\${m.letters.map(letterCard).join('')}</div>\`).join('');
  pack.innerHTML = '<div class="note">✅ Payment confirmed — here is your full action pack.</div>'+blocks;
  pack.scrollIntoView({behavior:'smooth'});
}
</script>
</body></html>`;
}
