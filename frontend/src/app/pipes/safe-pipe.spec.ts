import { SafePipe } from './safe-pipe';

describe('Biztonságos tartalom megjelenítése', () => {
  it('létrehozható', () => {
    const pipe = new SafePipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
