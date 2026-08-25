'use strict';

const BROWSABLE_PROTOCOLS = new Set(['http:', 'https:']);
const EXTERNAL_PROTOCOLS = new Set(['mailto:']);

function protocolIsAllowed(value, protocols) {
  try {
    return protocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isBrowsableUrl(value) {
  return protocolIsAllowed(value, BROWSABLE_PROTOCOLS);
}

function isAllowedExternalUrl(value) {
  return protocolIsAllowed(value, EXTERNAL_PROTOCOLS);
}

module.exports = { isAllowedExternalUrl, isBrowsableUrl };
