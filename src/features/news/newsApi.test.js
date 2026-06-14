import { describe, it, expect } from 'vitest';
import { parseRss } from '../../../api/news.js';

const SAMPLE = `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Roads, houses wrecked in Glan as aftershocks continue - Inquirer</title>
    <link>https://news.example/glan</link>
    <pubDate>Mon, 08 Jun 2026 09:30:00 GMT</pubDate>
    <source url="https://inquirer.net">Inquirer</source>
    <description><![CDATA[<a href="x">snippet here</a>]]></description>
  </item>
  <item>
    <title>General Santos assesses damage - GMA</title>
    <link>https://news.example/gensan</link>
    <pubDate>Mon, 08 Jun 2026 08:00:00 GMT</pubDate>
    <source url="https://gma.com">GMA</source>
  </item>
</channel></rss>`;

describe('parseRss (Google News)', () => {
  const items = parseRss(SAMPLE);

  it('parses each item', () => {
    expect(items).toHaveLength(2);
  });

  it('strips the trailing " - Source" from the headline', () => {
    expect(items[0].title).toBe('Roads, houses wrecked in Glan as aftershocks continue');
    expect(items[0].source).toBe('Inquirer');
  });

  it('extracts link and a parsed timestamp', () => {
    expect(items[0].url).toBe('https://news.example/glan');
    expect(items[0].publishedAt).toBe(Date.parse('Mon, 08 Jun 2026 09:30:00 GMT'));
  });

  it('is safe on empty input', () => {
    expect(parseRss('')).toEqual([]);
  });
});
