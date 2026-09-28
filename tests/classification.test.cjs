const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const cases = require('./classification-cases.json');
const context = { window: {} };
vm.createContext(context);
const html = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
vm.runInContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1], context);
const { classify, defaultSettings } = context.window.AlertTriage;

test('classification benchmark: expected categories and reasons', t => {
  const failures = [];
  let missedUrgent = 0, unnecessaryVoice = 0;
  for (const sample of cases) {
    const actual = classify(sample, { ...defaultSettings, ...sample.settings });
    if (actual.bucket !== sample.expected) {
      if (sample.expected === 'urgent') missedUrgent++; else unnecessaryVoice++;
      failures.push({ id:sample.id, expected:sample.expected, actual:actual.bucket, why:sample.why });
    }
  }
  t.diagnostic(`${cases.length} cases; missed urgent: ${missedUrgent}; unnecessary voice: ${unnecessaryVoice}`);
  assert.deepEqual(failures, []);
});

test('every decision names its rule and explains it', () => {
  for (const sample of cases) {
    const actual = classify(sample, { ...defaultSettings, ...sample.settings });
    assert.ok(actual.rule, `missing rule: ${sample.id}`);
    assert.ok(actual.reason, `missing explanation: ${sample.id}`);
  }
});

test('the benchmark embedded in the page matches the test file', () => {
  const embedded = html.match(/<script type="application\/json" id="benchmarkCases">([\s\S]*?)<\/script>/);
  assert.ok(embedded, 'embedded benchmark');
  assert.deepEqual(JSON.parse(embedded[1]), cases);
});

test('every decision has a five-check trace ending at the deciding check', () => {
  for (const sample of cases) {
    const actual = classify(sample, { ...defaultSettings, ...sample.settings });
    assert.equal(actual.steps.length, 5, sample.id);
    const decisive = actual.steps.filter(s => s.status === 'stop' || s.status === 'override');
    if (actual.bucket === 'low') assert.equal(decisive.length, 1, sample.id);
    else assert.ok(actual.steps.every(s => s.status !== 'stop'), sample.id);
  }
});
