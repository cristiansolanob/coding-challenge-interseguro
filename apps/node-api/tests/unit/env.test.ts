import { loadConfig } from '../../src/config/env';

describe('loadConfig', () => {
  const originalPort = process.env['PORT'];

  afterEach(() => {
    if (originalPort === undefined) delete process.env['PORT'];
    else process.env['PORT'] = originalPort;
  });

  it('Default port: PORT unset -> port is 3001', () => {
    delete process.env['PORT'];
    expect(loadConfig().port).toBe(3001);
  });

  it('Override: PORT=4000 -> port is 4000', () => {
    process.env['PORT'] = '4000';
    expect(loadConfig().port).toBe(4000);
  });

  it('Invalid PORT (non-numeric) -> throws', () => {
    process.env['PORT'] = 'not-a-number';
    expect(() => loadConfig()).toThrow();
  });
});
