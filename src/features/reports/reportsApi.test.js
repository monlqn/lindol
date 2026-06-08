import { describe, it, expect, vi } from 'vitest';
import { normalizeRow, fetchRecentReports, flagReport } from './reportsApi.js';

describe('normalizeRow', () => {
  it('maps a db row to the Report shape', () => {
    const row = { id: 'a', created_at: '2026-06-08T07:42:00Z', category: 'fire',
      note: 'hi', lat: 7, lng: 126, photo_url: 'u', status: 'visible', flag_count: 2 };
    expect(normalizeRow(row)).toEqual({
      id: 'a', createdAt: Date.parse('2026-06-08T07:42:00Z'), category: 'fire',
      note: 'hi', lat: 7, lng: 126, photoUrl: 'u', status: 'visible', flagCount: 2, sensitive: false,
      state: 'open', confirmCount: 0,
    });
  });
});

describe('fetchRecentReports', () => {
  it('queries reports and returns normalized rows', async () => {
    const rows = [{ id: 'a', created_at: '2026-06-08T07:42:00Z', category: 'fire',
      note: '', lat: 7, lng: 126, photo_url: null, status: 'visible', flag_count: 0 }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const gte = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ gte }));
    const client = { from: vi.fn(() => ({ select })) };
    const out = await fetchRecentReports(client);
    expect(client.from).toHaveBeenCalledWith('reports');
    expect(out[0].id).toBe('a');
  });
});

describe('flagReport', () => {
  it('calls the flag_report rpc with device id and reason', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await flagReport({ rpc }, 'rid-1', 'dev-1', 'fake');
    expect(rpc).toHaveBeenCalledWith('flag_report', { rid: 'rid-1', dev: 'dev-1', reason: 'fake' });
  });

  it('passes null reason when none given', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await flagReport({ rpc }, 'rid-1', 'dev-1');
    expect(rpc).toHaveBeenCalledWith('flag_report', { rid: 'rid-1', dev: 'dev-1', reason: null });
  });
});
