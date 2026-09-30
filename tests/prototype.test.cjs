const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(saved = {}) {
  const nodes = {}, speech = [], tones = [], timers = new Map();
  let timerId = 0, cancels = 0;
  function element(tag) {
    return { tag, value: '', checked: true, children: [], handlers: {},
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; },
      setAttribute() {},
      addEventListener(event, fn) { this.handlers[event] = fn; }
    };
  }
  const context = { window: { addEventListener() {} },
    document: { getElementById(id) { return nodes[id] ??= element('input'); }, createElement: element },
    localStorage: { getItem() { return JSON.stringify(saved); }, setItem(k, v) { saved = JSON.parse(v); } },
    SpeechSynthesisUtterance: function(text) { this.text = text; },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  context.window.speechSynthesis = { cancel() { cancels++; }, speak(u) { speech.push(u); } };
  context.window.AudioContext = function() {
    this.currentTime = 0; this.state = 'running';
    this.createOscillator = () => ({ frequency: { setValueAtTime(f) { tones.push(f); } }, connect() { return { connect() {} }; }, start() {}, stop() {} });
    this.createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  };
  vm.createContext(context);
  const html = fs.readFileSync(require('node:path').join(__dirname, '../dist/index.html'), 'utf8');
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) context.document.getElementById(match[1]);
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  return { nodes, speech, tones, context, saved: () => saved, cancels: () => cancels,
    click(id) { nodes[id].handlers.click(); },
    tick() { const entry = [...timers].sort((a,b) => a[1].ms-b[1].ms)[0]; assert.ok(entry, 'scheduled continuation'); timers.delete(entry[0]); entry[1].fn(); },
    classify(message, overrides = {}) { return context.window.AlertTriage.classify(message, { ...context.window.AlertTriage.defaultSettings, ...overrides }); }
  };
}

test('school deadline, work request, routine and misleading urgency', () => {
  const a = app();
  const cases = [
    [{ sender:'professor@campus.example', body:'Assignment due today. Please submit.' }, 'urgent'],
    [{ sender:'dispatch@team.example', body:'Route blocked. Call me now.' }, 'urgent'],
    [{ sender:'+1 (555) 010-1234', body:'Delivery blocked. Call me now.' }, 'urgent'],
    [{ sender:'schedule@team.example', body:'Next week rota. No rush.' }, 'low'],
    [{ sender:'professor@campus.example', body:'Assignment due tomorrow.' }, 'low'],
    [{ sender:'stranger@unknown.example', body:'URGENT reply now!' }, 'low'],
    [{ sender:'dispatch@team.example', body:'URGENT newsletter. Unsubscribe.' }, 'low'],
    [{ sender:'dispatch@team.example', body:'Not urgent, please review.' }, 'low'],
    [{ sender:'dispatch@team.example.evil.test', body:'Call me now.' }, 'low']
  ];
  for (const [message, expected] of cases) assert.equal(a.classify(message).bucket, expected, message.body);
  assert.equal(a.classify({ sender:'dispatch@team.example', body:'urgent' }, { subscriptionSources:'dispatch@team.example', alwaysUrgent:'dispatch@team.example' }).bucket, 'low');
});

test('everyday examples load on open, stay two urgent and three low, and loading is silent', () => {
  const a = app();
  assert.equal(a.nodes.urgentCount.textContent, '2'); assert.equal(a.nodes.lowCount.textContent, '3');
  a.click('loadExamples');
  assert.equal(a.nodes.urgentCount.textContent, '2'); assert.equal(a.nodes.lowCount.textContent, '3');
  assert.equal(a.speech.length, 0); assert.equal(a.tones.length, 0);
});

test('low plays sound only; queued urgent messages finish without cancellation', () => {
  const a = app(); a.click('previewLow');
  assert.deepEqual(a.tones, [440]); assert.equal(a.speech.length, 0);
  a.tick(); a.click('previewUrgent'); a.click('previewUrgent');
  assert.deepEqual(a.tones, [440,690,900]);
  a.tick(); assert.equal(a.speech.length, 1); assert.equal(a.speech[0].text, 'Urgent message. Please check.');
  a.speech[0].onend(); assert.deepEqual(a.tones, [440,690,900,690,900]);
  a.tick(); assert.equal(a.speech.length, 2); assert.equal(a.cancels(), 0);
  a.speech[1].onend(); assert.match(a.nodes.audioStatus.textContent, /ready/i);
});

test('stop cancels speech and discards pending alerts', () => {
  const a = app(); a.click('previewUrgent'); a.click('previewUrgent'); a.tick();
  a.click('stopAlerts'); a.speech[0].onend();
  assert.equal(a.cancels(), 1); assert.equal(a.speech.length, 1);
  assert.match(a.nodes.audioStatus.textContent, /stopped/i);
});

test('saved sender corrections survive reload and subscriptions take priority', () => {
  const a = app(); a.click('loadExamples');
  const card = a.nodes.urgentCards.children[0];
  const row = card.children.find(n => n.className === 'sender-rule');
  assert.ok(row, 'sender correction controls');
  const select = row.children.find(n => n.tag === 'select');
  select.value = 'subscriptionSources'; row.children.find(n => n.tag === 'button').handlers.click();
  assert.equal(a.nodes.urgentCount.textContent, '1'); assert.equal(a.nodes.lowCount.textContent, '4');
  const stored = a.saved(); assert.ok(stored.subscriptionSources);
  const restored = app(stored);
  assert.equal(restored.classify({ sender: stored.subscriptionSources, body:'URGENT' }, stored).bucket, 'low');
});

test('changing an always-urgent sender back to trusted restores phrase checking', () => {
  const a = app({ alwaysUrgent:'recruiter@careers.example' }); a.click('loadExamples');
  const row = a.nodes.urgentCards.children[0].children.find(n => n.className === 'sender-rule');
  row.children.find(n => n.tag === 'select').value = 'trustedSources';
  row.children.find(n => n.tag === 'button').handlers.click();
  assert.equal(a.classify({ sender:'recruiter@careers.example', body:'Here are the details for next week.' }, a.saved()).bucket, 'low');
});

test('audio preferences and unsupported speech preserve sound-only behavior', () => {
  const a = app(); a.nodes.voiceEnabled.checked = false; a.click('previewUrgent'); a.tick();
  assert.equal(a.speech.length, 0); assert.deepEqual(a.tones, [690,900]);
  a.nodes.soundEnabled.checked = false; a.click('previewLow');
  assert.deepEqual(a.tones, [690,900]);
  a.nodes.voiceEnabled.checked = true; a.click('previewUrgent');
  assert.equal(a.speech.length, 1); a.speech[0].onend();
  delete a.context.window.speechSynthesis;
  a.click('previewUrgent'); assert.match(a.nodes.audioStatus.textContent, /unavailable/);
});

test('failed speech releases the queue, and timed-out speech is canceled', () => {
  const a = app(); a.nodes.soundEnabled.checked = false;
  a.click('previewUrgent'); a.click('previewUrgent');
  a.speech[0].onerror(); assert.equal(a.speech.length, 2);
  a.tick(); assert.equal(a.cancels(), 1); assert.match(a.nodes.audioStatus.textContent, /timed out/);
});

test('tricky examples are all low, and corrupted stored preferences recover', () => {
  const a = app({ trustedSources:42, alwaysUrgent:null }); a.click('loadEdgeCases');
  assert.equal(a.nodes.urgentCount.textContent, '0'); assert.equal(a.nodes.lowCount.textContent, '5');
});

test('scam-like examples stay low and each playback is sound only', () => {
  const a = app(); a.click('loadScamExamples');
  assert.equal(a.nodes.urgentCount.textContent, '0'); assert.equal(a.nodes.lowCount.textContent, '5');
  assert.equal(a.tones.length, 0);
  for (const card of a.nodes.lowCards.children) {
    card.children.find(n => n.className === 'card-actions').children[0].handlers.click();
    a.tick();
  }
  assert.deepEqual(a.tones, [440,440,440,440,440]); assert.equal(a.speech.length, 0);
});

test('all benchmark messages reach the correct column and audio path through the form', () => {
  for (const sample of require('./classification-cases.json')) {
    const a = app(sample.settings); a.click('clearMessages');
    a.nodes.channel.value = 'Email'; a.nodes.sender.value = sample.sender;
    a.nodes.subject.value = sample.subject || ''; a.nodes.body.value = sample.body || '';
    a.nodes.subscription.checked = !!sample.subscription;
    a.nodes.messageForm.handlers.submit({ preventDefault() {} });
    const urgent = sample.expected === 'urgent';
    assert.equal(a.nodes.urgentCount.textContent, urgent ? '1' : '0', sample.id);
    assert.equal(a.nodes.lowCount.textContent, urgent ? '0' : '1', sample.id);
    assert.deepEqual(a.tones, urgent ? [690,900] : [440], sample.id);
    a.tick(); assert.equal(a.speech.length, urgent ? 1 : 0, sample.id);
  }
});

test('every card shows five checks, and urgent cards highlight their deciding phrase', () => {
  const a = app();
  const cards = [...a.nodes.urgentCards.children, ...a.nodes.lowCards.children];
  assert.equal(cards.length, 5);
  for (const card of cards) {
    const trace = card.children.find(n => n.className === 'why').children.find(n => n.className === 'trace');
    assert.equal(trace.children.length, 5);
  }
  const marks = a.nodes.urgentCards.children.flatMap(card => card.children.flatMap(n => n.children || [])).filter(n => n.tag === 'mark');
  assert.ok(marks.some(n => n.className === 'hl-urgent'), 'urgent phrase highlighted');
});

test('in-page benchmark compares current and previous rules', () => {
  const a = app();
  a.nodes.benchmarkCases.textContent = fs.readFileSync(require('node:path').join(__dirname, 'classification-cases.json'), 'utf8');
  a.nodes.benchChangedOnly.checked = true;
  a.click('runBenchmark');
  assert.equal(a.nodes.benchCurrent.textContent, '78 / 78');
  assert.equal(a.nodes.benchPrevious.textContent, '50 / 78');
  assert.match(a.nodes.benchPreviousDetail.textContent, /8 missed urgent · 20 unnecessary/);
  assert.equal(a.nodes.benchList.children.length, 29);
});

test('generated messages: known phrasing always matches the generator spec', () => {
  const a = app();
  const { generate } = a.context.window.MessageGenerator;
  assert.deepEqual(generate({ count: 20, seed: 7 }), generate({ count: 20, seed: 7 }), 'same seed, same messages');
  const groups = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    for (const message of generate({ count: 300, seed })) {
      groups.add(message.group);
      assert.equal(a.classify(message).bucket, message.expected, `${message.group}: ${message.sender} | ${message.subject} | ${message.body}`);
    }
  }
  assert.ok(groups.size >= 15, 'covers many scenario and sender groups');
});

test('generated messages: natural phrasing exposes known gaps without changing known results', () => {
  const a = app();
  const natural = a.context.window.MessageGenerator.generate({ count: 500, seed: 3, natural: true });
  const failures = natural.filter(m => a.classify(m).bucket !== m.expected);
  assert.ok(failures.length > 0, 'natural phrasing should reveal at least one gap');
  assert.ok(failures.every(m => m.natural), 'every failure comes from natural phrasing');
});

test('newly supported phrases stay covered by the known-phrasing generator', () => {
  const a = app();
  const phrases = ['in half an hour', 'has been called off', "don't worry about replying right away"];
  const seen = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    for (const message of a.context.window.MessageGenerator.generate({ count: 300, seed })) {
      for (const phrase of phrases) {
        if ([message.subject, message.body].filter(Boolean).join(' ').includes(phrase)) {
          seen.add(phrase);
          assert.equal(message.natural, false, phrase);
          assert.equal(a.classify(message).bucket, message.expected, `${phrase}: ${message.body}`);
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), phrases.sort());
});

test('generator panel reports a score and a sent message plays its alert', () => {
  const a = app();
  a.nodes.genCount.value = '200'; a.nodes.genSeed.value = '11'; a.nodes.genNatural.checked = false;
  a.click('runGenerator');
  assert.equal(a.nodes.genScore.textContent, '200 / 200');
  a.click('addGenerated');
  assert.equal(Number(a.nodes.urgentCount.textContent) + Number(a.nodes.lowCount.textContent), 6);
  assert.ok(a.tones.length > 0, 'incoming generated message plays an alert');
});
