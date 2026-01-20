/**
 * MSW Request Handlers
 * Mock API responses for testing
 */
import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:8000';

export const handlers = [
  // Login
  http.post(`${API_BASE_URL}/login`, async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.username === 'demo' && body.password === 'demo123') {
      return HttpResponse.json({
        access_token: 'mock_token_12345',
        token_type: 'bearer',
      });
    }
    
    return HttpResponse.json(
      { detail: 'Incorrect username or password' },
      { status: 401 }
    );
  }),

  // VaR Timeline
  http.get(`${API_BASE_URL}/var/timeline`, () => {
    return HttpResponse.json({
      confidence_level: 0.95,
      currency: 'USD',
      timeline: [
        {
          date: '2026-01-01',
          scenario: 'without_hedge',
          var: { sugar: 100000, flour: 80000, portfolio: 150000 },
        },
        {
          date: '2026-01-01',
          scenario: 'with_hedge',
          var: { sugar: 60000, flour: 70000, portfolio: 100000 },
        },
        {
          date: '2026-06-01',
          scenario: 'without_hedge',
          var: { sugar: 120000, flour: 90000, portfolio: 170000 },
        },
        {
          date: '2026-06-01',
          scenario: 'with_hedge',
          var: { sugar: 70000, flour: 75000, portfolio: 110000 },
        },
      ],
    });
  }),

  // Futures Contracts
  http.get(`${API_BASE_URL}/market-data/futures`, () => {
    return HttpResponse.json([
      { commodity: 'sugar', contract_month: '2026-02-01', price: 0.52, source: 'futures' },
      { commodity: 'sugar', contract_month: '2026-04-01', price: 0.53, source: 'futures' },
      { commodity: 'flour', contract_month: '2026-02-01', price: 0.40, source: 'futures' },
      { commodity: 'flour', contract_month: '2026-04-01', price: 0.41, source: 'futures' },
    ]);
  }),

  // Hedge Session
  http.post(`${API_BASE_URL}/hedge-session/create`, () => {
    return HttpResponse.json({
      id: 'session_123',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }),

  http.get(`${API_BASE_URL}/hedge-session/current`, () => {
    return HttpResponse.json({
      id: 'session_123',
      status: 'active',
      created_at: new Date().toISOString(),
      items: [],
    });
  }),

  http.post(`${API_BASE_URL}/hedge-session/add`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      commodity: body.commodity,
      contract_month: body.contract_month,
      quantity: body.quantity,
      price_snapshot: 0.50,
    });
  }),

  http.post(`${API_BASE_URL}/hedge-session/execute`, () => {
    return HttpResponse.json({
      status: 'executed',
      executed_at: new Date().toISOString(),
      final_var: { sugar: 60000, flour: 70000, portfolio: 100000 },
    });
  }),

  // Upload
  http.post(`${API_BASE_URL}/upload/purchases`, () => {
    return HttpResponse.json({
      message: 'Upload successful',
      rows_processed: 14,
      exposure_buckets_created: 42,
    });
  }),

  http.post(`${API_BASE_URL}/upload/inventory`, () => {
    return HttpResponse.json({
      message: 'Upload successful',
      rows_processed: 2,
    });
  }),

  // Market Data Refresh
  http.post(`${API_BASE_URL}/market-data/refresh`, () => {
    return HttpResponse.json({
      message: 'Market data refreshed',
      commodities_updated: ['sugar', 'flour'],
      prices_added: 22,
      futures_contracts_updated: 8,
    });
  }),
];
