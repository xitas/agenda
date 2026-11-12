import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVER_URL,
  isLocalServer,
  normalizeServerUrl,
  SERVER_URL_MESSAGES,
} from './server-url.js';

describe('normalizeServerUrl', () => {
  it('gives the origin of a full address', () => {
    expect(normalizeServerUrl(DEFAULT_SERVER_URL)).toEqual({ ok: true, url: DEFAULT_SERVER_URL });
    expect(normalizeServerUrl('  https://API.Example.com/  ')).toEqual({
      ok: true,
      url: 'https://api.example.com',
    });
    expect(normalizeServerUrl('https://api.example.com:443')).toEqual({
      ok: true,
      url: 'https://api.example.com',
    });
  });

  it('adds http:// for this PC and the local network, https:// for everything else', () => {
    expect(normalizeServerUrl('localhost:4001')).toEqual({
      ok: true,
      url: 'http://localhost:4001',
    });
    expect(normalizeServerUrl('192.168.1.20:4001')).toEqual({
      ok: true,
      url: 'http://192.168.1.20:4001',
    });
    expect(normalizeServerUrl('172.20.0.5')).toEqual({ ok: true, url: 'http://172.20.0.5' });
    expect(normalizeServerUrl('api.example.com')).toEqual({
      ok: true,
      url: 'https://api.example.com',
    });
  });

  it('explains what is wrong with anything else', () => {
    expect(normalizeServerUrl('   ')).toEqual({ ok: false, error: SERVER_URL_MESSAGES.missing });
    expect(normalizeServerUrl('http://')).toEqual({
      ok: false,
      error: SERVER_URL_MESSAGES.invalid,
    });
    expect(normalizeServerUrl('ftp://files.example.com')).toEqual({
      ok: false,
      error: SERVER_URL_MESSAGES.protocol,
    });
    for (const url of [
      'https://api.example.com/v1',
      'https://api.example.com/?x=1',
      'https://api.example.com/#top',
      'https://user:secret@api.example.com',
    ]) {
      expect(normalizeServerUrl(url)).toEqual({ ok: false, error: SERVER_URL_MESSAGES.path });
    }
  });
});

describe('local servers and https', () => {
  it('knows this device and private networks by address', () => {
    for (const origin of [
      'http://localhost:4001',
      'http://127.0.0.1:4001',
      'http://10.0.2.2:4001',
      'http://192.168.1.20:4001',
      'http://172.20.0.5',
      'http://[::1]:4001',
    ]) {
      expect(isLocalServer(origin)).toBe(true);
    }
    for (const origin of [
      'https://api.example.com',
      'http://10.example.com',
      'http://172.32.0.1',
      'http://8.8.8.8',
    ]) {
      expect(isLocalServer(origin)).toBe(false);
    }
  });

  it('refuses plain http outside the local network when asked (the phone app)', () => {
    const phone = { httpsOutsideLocal: true };
    expect(normalizeServerUrl('192.168.1.20:4001', phone)).toEqual({
      ok: true,
      url: 'http://192.168.1.20:4001',
    });
    expect(normalizeServerUrl('http://api.example.com', phone)).toEqual({
      ok: false,
      error: SERVER_URL_MESSAGES.https,
    });
    expect(normalizeServerUrl('api.example.com', phone)).toEqual({
      ok: true,
      url: 'https://api.example.com',
    });
    // Without the option (web, desktop), http stays allowed.
    expect(normalizeServerUrl('http://api.example.com')).toEqual({
      ok: true,
      url: 'http://api.example.com',
    });
  });
});
