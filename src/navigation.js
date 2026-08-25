'use strict';

const BROWSABLE_PROTOCOLS = new Set(['http:', 'https:']);
const USER_NAVIGABLE_PROTOCOLS = new Set(['http:', 'https:', 'about:', 'data:', 'file:']);
const EXTERNAL_PROTOCOLS = new Set(['mailto:']);

function protocolIsAllowed(value, protocols) {
  try {
    return protocols.has(new URL(value).protocol.toLowerCase());
  } catch {
    return false;
  }
}

function isBrowsableUrl(value) {
  return protocolIsAllowed(value, BROWSABLE_PROTOCOLS);
}

function isUserNavigableUrl(value) {
  return protocolIsAllowed(value, USER_NAVIGABLE_PROTOCOLS);
}

function isAllowedExternalUrl(value) {
  return protocolIsAllowed(value, EXTERNAL_PROTOCOLS);
}

function normalizeInput(value) {
  const input = value.trim();
  if (!input) return null;
  if (isUserNavigableUrl(input)) return input;
  if (/^[\w.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(input)) return `https://${input}`;
  return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
}

module.exports = { isAllowedExternalUrl, isBrowsableUrl, isUserNavigableUrl, normalizeInput };
