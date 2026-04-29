if (window.__leadScorerLoaded) {
  // Already loaded
} else {
  window.__leadScorerLoaded = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ping') { sendResponse({ ok: true }); return true; }
    if (msg.action === 'scrape') {
      scrapeAll().then(sendResponse).catch(err => sendResponse({ error: err.message }));
      return true;
    }
  });
}

async function scrapeAll() {
  sendProgress(0, 'Loading all connection requests...');
  await loadAll();
  sendProgress(90, 'Extracting profiles...');
  const profiles = extractProfiles();
  sendProgress(100, 'Found ' + profiles.length + ' profiles');
  return profiles;
}

function sendProgress(pct, text) {
  chrome.runtime.sendMessage({ action: 'scrapeProgress', pct, text }).catch(() => {});
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loadAll() {
  let lastCount = 0, stale = 0, step = 0;
  const MAX_STALE = 6, MAX_STEPS = 80;

  while (stale < MAX_STALE && step < MAX_STEPS) {
    // Click "Show more" buttons
    Array.from(document.querySelectorAll('button, a[role="button"]'))
      .filter(el => /show more|load more|see more|view more|mostra|mehr/i.test(el.innerText || ''))
      .forEach(btn => { try { btn.click(); } catch(e) {} });

    // Scroll window
    window.scrollTo(0, document.body.scrollHeight);

    // Scroll inner containers
    document.querySelectorAll('[class*="scaffold-finite"],[class*="invitation"],[class*="artdeco-list"]')
      .forEach(el => { if (el.scrollHeight > el.clientHeight + 10) el.scrollTop = el.scrollHeight; });

    await sleep(1800);

    const count = Array.from(document.querySelectorAll('button'))
      .filter(b => /accept|accetta|akzeptieren|accepter/i.test(b.innerText || '')).length;

    if (count === lastCount) stale++;
    else { stale = 0; lastCount = count; }

    step++;
    sendProgress(Math.min(85, Math.round(step / MAX_STEPS * 85)),
      'Loading... ' + lastCount + ' invitation' + (lastCount !== 1 ? 's' : '') + ' found');
  }
}

function extractProfiles() {
  const results = [], seen = new Set();

  Array.from(document.querySelectorAll('button,[role="button"]'))
    .filter(b => /accept|accetta|akzeptieren|accepter/i.test(b.innerText || b.textContent || ''))
    .forEach(btn => {
      const card = btn.closest('li[class*="invit"],li[class*="invitation"],article[class*="invitation"]')
        || btn.closest('li,article,[class*="card"],[class*="invitation"],[class*="request"]')
        || btn.parentElement?.parentElement?.parentElement;
      if (!card) return;

      const linkEl = card.querySelector('a[href*="/in/"]');
      if (!linkEl) return;

      const href = linkEl.getAttribute('href') || '';
      const url = 'https://www.linkedin.com' + href.split('?')[0];
      if (seen.has(url)) return;
      seen.add(url);

      let name = '';
      const nameEl = card.querySelector('[class*="actor-name"],[class*="authorName"],[class*="lockup__title"],[class*="inviter"]');
      if (nameEl) name = nameEl.innerText.trim();
      if (!name) {
        const spans = Array.from(card.querySelectorAll('span[aria-hidden="true"],strong,b'))
          .filter(el => { const t = el.innerText.trim(); return t && t.length > 1 && t.length < 80 && !/picture|connect|accept|ignore|withdraw|open to work/i.test(t); });
        if (spans.length) name = spans[0].innerText.trim();
      }
      if (!name) name = linkEl.innerText.trim().replace(/\s*'?s?\s*profile\s*picture.*/i,'').replace(/open to work,?\s*/i,'').trim();
      if (!name || /profile picture/i.test(name)) return;

      let title = '';
      const titleEl = card.querySelector('[class*="subline"],[class*="occupation"],[class*="headline"],[class*="lockup__subtitle"],[class*="subtitle"]');
      if (titleEl) title = titleEl.innerText.trim();
      if (!title) {
        const nodes = Array.from(card.querySelectorAll('span,p'))
          .filter(el => { const t = el.innerText.trim(); return t && t !== name && t.length > 5 && t.length < 200 && !/accept|ignore|connect|withdraw|picture/i.test(t); });
        if (nodes.length) title = nodes[0].innerText.trim();
      }

      results.push({ name, title, company: '', url, about: '' });
    });

  return results;
}
