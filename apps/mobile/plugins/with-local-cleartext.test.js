const { networkSecurityConfig, parseHosts } = require('./with-local-cleartext');

describe('with-local-cleartext', () => {
  it('always allows this device and the emulator, plus the hosts given', () => {
    expect(parseHosts()).toEqual(['localhost', '127.0.0.1', '10.0.2.2']);
    expect(parseHosts(' 192.168.1.20 , mypc.local,192.168.1.20 ')).toEqual([
      'localhost',
      '127.0.0.1',
      '10.0.2.2',
      '192.168.1.20',
      'mypc.local',
    ]);
  });

  it('refuses anything that isn’t a bare host', () => {
    expect(() => parseHosts('http://192.168.1.20')).toThrow('AGENDA_DEV_HOSTS');
    expect(() => parseHosts('192.168.1.20:4001')).toThrow('no scheme or port');
  });

  it('allows cleartext only to those hosts; HTTPS for the rest', () => {
    const xml = networkSecurityConfig(['localhost', '192.168.1.20']);
    expect(xml).toContain('<base-config cleartextTrafficPermitted="false">');
    expect(xml).toContain('<domain-config cleartextTrafficPermitted="true">');
    expect(xml).toContain('<domain includeSubdomains="false">192.168.1.20</domain>');
    expect(xml.match(/<domain /g)).toHaveLength(2);
  });
});
