/**
 * Thin client for the DuckDuckGo Email Protection ("duck.com") service.
 *
 * This mirrors the private, unofficial API used internally by DuckDuckGo's
 * own browser extension (https://github.com/duckduckgo/duckduckgo-privacy-extension)
 * to log in and mint new "Generate Private Duck Address" aliases. It is not
 * a documented/public API and DuckDuckGo may change it at any time without
 * notice.
 *
 * Only use this against an account you own.
 */

const BASE_URL = 'https://quack.duckduckgo.com/api';
const USER_AGENT = 'duckmail-desktop/0.1 (+https://duckduckgo.com/email)';
const REQUEST_TIMEOUT_MS = 15000;

class DuckMailError extends Error {}
class AuthenticationError extends DuckMailError {}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function stripDuckSuffix(username) {
  return username.trim().replace(/@duck\.com$/i, '');
}

async function requestLoginCode(duckUsername) {
  const username = stripDuckSuffix(duckUsername);
  const url = `${BASE_URL}/auth/loginlink?${new URLSearchParams({ user: username })}`;
  const resp = await request(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new DuckMailError(
      `Failed to request a login code for '${username}' (HTTP ${resp.status}): ${text.slice(0, 200)}`
    );
  }
}

function extractOtp(userInput) {
  const trimmed = userInput.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    const otp = parsed.searchParams.get('otp');
    if (!otp) {
      throw new DuckMailError("Could not find an 'otp' parameter in the pasted link.");
    }
    return otp;
  }
  const code = trimmed.replace(/\s+/g, '');
  if (!code) {
    throw new DuckMailError('Empty OTP code.');
  }
  return code;
}

async function verifyLoginCode(duckUsername, otp) {
  const username = stripDuckSuffix(duckUsername);
  const url = `${BASE_URL}/auth/login?${new URLSearchParams({ user: username, otp })}`;
  const resp = await request(url);
  if (resp.status === 401 || resp.status === 403) {
    throw new AuthenticationError('The login code was rejected or has expired. Request a new one.');
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new DuckMailError(`Login failed (HTTP ${resp.status}): ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    throw new DuckMailError('Unexpected (non-JSON) response from DuckDuckGo during login.');
  }
  const token = data.token || data.access_token;
  if (!token) {
    throw new DuckMailError(`Login response did not contain a token: ${JSON.stringify(data)}`);
  }

  let mainAddress = null;
  try {
    mainAddress = await getMainAddress(token);
  } catch (err) {
    // Non-fatal: some accounts/responses may not expose this.
  }

  return { token, mainAddress };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function getMainAddress(token) {
  const resp = await request(`${BASE_URL}/email/addresses`, { headers: authHeaders(token) });
  if (resp.status === 401 || resp.status === 403) {
    throw new AuthenticationError('Session expired. Please log in again.');
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new DuckMailError(`Failed to fetch main address (HTTP ${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.address) {
    throw new DuckMailError(`Unexpected response fetching main address: ${JSON.stringify(data)}`);
  }
  return data.address;
}

async function generateAlias(token) {
  const resp = await request(`${BASE_URL}/email/addresses`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new AuthenticationError('Session expired. Please log in again.');
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new DuckMailError(`Failed to generate alias (HTTP ${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.address) {
    throw new DuckMailError(`Unexpected response generating alias: ${JSON.stringify(data)}`);
  }
  return data.address;
}

module.exports = {
  DuckMailError,
  AuthenticationError,
  requestLoginCode,
  extractOtp,
  verifyLoginCode,
  getMainAddress,
  generateAlias,
};
