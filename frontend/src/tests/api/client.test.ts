/**
 * API Client Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../../api/client';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has correct base URL', () => {
    expect(apiClient.defaults.baseURL).toBe('http://localhost:8000');
  });

  it('has correct default headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('is configured with axios', () => {
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.post).toBe('function');
  });

  it('has request interceptors configured', () => {
    expect(apiClient.interceptors.request).toBeDefined();
  });
});
