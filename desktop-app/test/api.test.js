const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../src/api');

function mockResponse({ ok = true, status = 200, json = {}, text = '' } = {}) {
  return {
    ok,
    status,
    json: async () => json,
    text: async () => text,
  };
}

function withMockedFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  return fn().finally(() => {
    global.fetch = original;
  });
}

test('extractOtp: raw code strips whitespace', () => {
  assert.equal(api.extractOtp('  ABC 123 '), 'ABC123');
});

test('extractOtp: pulls otp param out of a pasted link', () => {
  const url = 'https://duckduckgo.com/email/login?otp=xyz789&user=someone';
  assert.equal(api.extractOtp(url), 'xyz789');
});

test('extractOtp: link without otp param throws', () => {
  assert.throws(() => api.extractOtp('https://duckduckgo.com/email/login?user=someone'), api.DuckMailError);
});

test('extractOtp: empty input throws', () => {
  assert.throws(() => api.extractOtp('   '), api.DuckMailError);
});

test('requestLoginCode: strips @duck.com and calls the right endpoint', async () => {
  let calledUrl;
  await withMockedFetch(
    async (url) => {
      calledUrl = url;
      return mockResponse({ ok: true });
    },
    async () => api.requestLoginCode('user@duck.com')
  );
  assert.match(calledUrl, /^https:\/\/quack\.duckduckgo\.com\/api\/auth\/loginlink\?user=user$/);
});

test('requestLoginCode: non-ok response throws DuckMailError', async () => {
  await assert.rejects(
    () =>
      withMockedFetch(
        async () => mockResponse({ ok: false, status: 500, text: 'boom' }),
        async () => api.requestLoginCode('user')
      ),
    api.DuckMailError
  );
});

test('verifyLoginCode: 401 throws AuthenticationError', async () => {
  await assert.rejects(
    () =>
      withMockedFetch(
        async () => mockResponse({ ok: false, status: 401 }),
        async () => api.verifyLoginCode('user', 'bad')
      ),
    api.AuthenticationError
  );
});

test('verifyLoginCode: success returns token and main address', async () => {
  let call = 0;
  const result = await withMockedFetch(
    async () => {
      call += 1;
      if (call === 1) return mockResponse({ ok: true, json: { token: 'tok123' } });
      return mockResponse({ ok: true, json: { address: 'myaddress' } });
    },
    async () => api.verifyLoginCode('user', '123456')
  );
  assert.equal(result.token, 'tok123');
  assert.equal(result.mainAddress, 'myaddress');
});

test('generateAlias: sends bearer token and returns address', async () => {
  let capturedHeaders;
  let capturedMethod;
  const address = await withMockedFetch(
    async (_url, options) => {
      capturedHeaders = options.headers;
      capturedMethod = options.method;
      return mockResponse({ ok: true, json: { address: 'abc123' } });
    },
    async () => api.generateAlias('tok123')
  );
  assert.equal(address, 'abc123');
  assert.equal(capturedMethod, 'POST');
  assert.equal(capturedHeaders.Authorization, 'Bearer tok123');
});

test('generateAlias: 403 throws AuthenticationError', async () => {
  await assert.rejects(
    () =>
      withMockedFetch(
        async () => mockResponse({ ok: false, status: 403 }),
        async () => api.generateAlias('tok123')
      ),
    api.AuthenticationError
  );
});

test('getMainAddress: missing address field throws DuckMailError', async () => {
  await assert.rejects(
    () =>
      withMockedFetch(
        async () => mockResponse({ ok: true, json: {} }),
        async () => api.getMainAddress('tok123')
      ),
    api.DuckMailError
  );
});
