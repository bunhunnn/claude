const test = require('node:test');
const assert = require('node:assert');
const a = require('../src/analyze');

test('out_of_stock mode flips to in_stock when sold-out text disappears', () => {
  const w = { mode: 'out_of_stock', keywords: 'Sold out, Unavailable' };
  assert.strictEqual(a.evaluate('Product - SOLD OUT', w).status, 'out_of_stock');
  assert.strictEqual(a.evaluate('Product - Add to cart', w).status, 'in_stock');
});

test('in_stock mode needs a keyword', () => {
  const w = { mode: 'in_stock', keywords: 'Add to cart' };
  assert.strictEqual(a.evaluate('add to cart', w).status, 'in_stock');
  assert.strictEqual(a.evaluate('nothing', w).status, 'out_of_stock');
});

test('change mode diffs against previous snapshot', () => {
  const w = { mode: 'change' };
  assert.strictEqual(a.evaluate('x', w, null).status, 'unchanged');
  assert.strictEqual(a.evaluate('x', w, 'x').status, 'unchanged');
  const r = a.evaluate('a\nnew', w, 'a\nold');
  assert.strictEqual(r.status, 'changed');
  assert.match(r.detail, /\+ new/);
  assert.match(r.detail, /- old/);
});

test('shouldAlert only fires on transition into in_stock', () => {
  assert.ok(a.shouldAlert('in_stock', 'out_of_stock'));
  assert.ok(a.shouldAlert('in_stock', undefined));
  assert.ok(!a.shouldAlert('in_stock', 'in_stock'));
  assert.ok(a.shouldAlert('changed', 'changed'));
  assert.ok(!a.shouldAlert('out_of_stock', 'in_stock'));
});

test('inWindow handles normal and overnight windows', () => {
  const at = (h, m) => new Date(2026, 0, 1, h, m);
  assert.ok(a.inWindow('', at(3, 0)));
  assert.ok(a.inWindow('08:00-22:00', at(9, 0)));
  assert.ok(!a.inWindow('08:00-22:00', at(23, 0)));
  assert.ok(a.inWindow('22:00-06:00', at(2, 0)));
  assert.ok(!a.inWindow('22:00-06:00', at(12, 0)));
});

test('nextAt picks the next upcoming time, wrapping to tomorrow', () => {
  const now = new Date(2026, 0, 1, 10, 0);
  assert.strictEqual(a.nextAt('09:00, 12:30', now).getHours(), 12);
  const t = a.nextAt('09:00', now);
  assert.strictEqual(t.getDate(), 2);
  assert.strictEqual(a.nextAt('garbage', now), null);
});

test('looksLoggedOut detects redirects to login', () => {
  assert.ok(a.looksLoggedOut('https://x.com/purchase', 'https://x.com/login?next=/purchase'));
  assert.ok(!a.looksLoggedOut('https://x.com/purchase', 'https://x.com/purchase'));
  assert.ok(!a.looksLoggedOut('https://x.com/login', 'https://x.com/login'));
});
