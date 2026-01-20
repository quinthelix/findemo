/**
 * API Endpoints - Typed API calls
 */
import { apiClient } from './client';
import type {
  LoginRequest,
  LoginResponse,
  VaRTimelineResponse,
  HedgeSessionWithItems,
  HedgeSessionItemCreate,
  HedgeSessionItem,
  ExecuteHedgeResponse,
  UploadResponse,
  MarketDataRefreshResponse,
  FuturesContract,
  VarPreviewRequest,
  VarPreviewResponse,
  DataStatusResponse,
  PortfolioResponse,
} from '../types/api';

// Authentication
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/login', data);
  return response.data;
};

// VaR
export const getVaRTimeline = async (params?: {
  confidence_level?: number;
  start_date?: string;
  end_date?: string;
}): Promise<VaRTimelineResponse> => {
  const response = await apiClient.get<VaRTimelineResponse>('/var/timeline', { params });
  return response.data;
};

// VaR Preview (NEW)
export const previewVarImpact = async (data: VarPreviewRequest): Promise<VarPreviewResponse> => {
  const response = await apiClient.post<VarPreviewResponse>('/var/preview', data);
  return response.data;
};

// Hedge Session
export const createHedgeSession = async () => {
  const response = await apiClient.post('/hedge-session/create');
  return response.data;
};

export const getCurrentHedgeSession = async (): Promise<HedgeSessionWithItems> => {
  const response = await apiClient.get<HedgeSessionWithItems>('/hedge-session/current');
  return response.data;
};

export const addHedgeItem = async (data: HedgeSessionItemCreate): Promise<HedgeSessionItem> => {
  const response = await apiClient.post<HedgeSessionItem>('/hedge-session/add', data);
  return response.data;
};

export const updateHedgeItem = async (
  commodity: string,
  contractMonth: string,
  quantity: number
): Promise<HedgeSessionItem> => {
  const response = await apiClient.post<HedgeSessionItem>(
    `/hedge-session/update/${commodity}/${contractMonth}`,
    { quantity }
  );
  return response.data;
};

export const removeHedgeItem = async (commodity: string, contractMonth: string) => {
  const response = await apiClient.delete(`/hedge-session/remove/${commodity}/${contractMonth}`);
  return response.data;
};

export const executeHedge = async (): Promise<ExecuteHedgeResponse> => {
  const response = await apiClient.post<ExecuteHedgeResponse>('/hedge-session/execute');
  return response.data;
};

// Upload
export const uploadPurchases = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UploadResponse>('/upload/purchases', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const uploadInventory = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UploadResponse>('/upload/inventory', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Market Data
export const refreshMarketData = async (): Promise<MarketDataRefreshResponse> => {
  const response = await apiClient.post<MarketDataRefreshResponse>('/market-data/refresh');
  return response.data;
};

export const getFuturesContracts = async (): Promise<FuturesContract[]> => {
  const response = await apiClient.get<FuturesContract[]>('/market-data/futures');
  return response.data;
};

// Data Status (NEW)
export const getDataStatus = async (): Promise<DataStatusResponse> => {
  const response = await apiClient.get<DataStatusResponse>('/data/status');
  return response.data;
};

// Data Reset (NEW)
export const resetData = async (dataType?: 'purchases' | 'inventory') => {
  const params = dataType ? { data_type: dataType } : {};
  const response = await apiClient.post('/data/reset', null, { params });
  return response.data;
};

// Portfolio (NEW)
export const getExecutedHedges = async (): Promise<PortfolioResponse> => {
  const response = await apiClient.get<PortfolioResponse>('/portfolio/executed-hedges');
  return response.data;
};
