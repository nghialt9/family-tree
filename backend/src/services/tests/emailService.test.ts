import { buildEmailHtml } from '../emailService';

describe('buildEmailHtml', () => {
  it('includes today birthday in Hôm nay section', () => {
    const html = buildEmailHtml(
      [{ personName: 'Lâm Trọng Nghĩa', type: 'birthday', daysUntil: 0 }],
      '02/05/2026',
    );
    expect(html).toContain('Hôm nay');
    expect(html).toContain('Lâm Trọng Nghĩa');
    expect(html).toContain('🎂');
  });

  it('includes 7-day death in Sắp tới section', () => {
    const html = buildEmailHtml(
      [{ personName: 'Lâm Văn A', type: 'death', daysUntil: 7 }],
      '02/05/2026',
    );
    expect(html).toContain('Sắp tới');
    expect(html).toContain('Lâm Văn A');
    expect(html).toContain('🙏');
  });

  it('contains app URL link', () => {
    process.env.APP_URL = 'https://example.com';
    const html = buildEmailHtml([], '02/05/2026');
    expect(html).toContain('https://example.com');
  });
});
