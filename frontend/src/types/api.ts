/**
 * API TypeScript types - matching AGENTS.md section 10
 * These are the exact typed contracts between frontend and backend
 */

// Shared Primitive Types
export type Commodity = "sugar" | "flour";
export type Scenario = "with_hedge" | "without_hedge";
export type HedgeSessionStatus = "active" | "executed" | "cancelled";

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Hedge Session Types
export interface HedgeSession {
  id: string;
  status: HedgeSessionStatus;
  created_at: string;
}

export interface HedgeSessionItem {
  commodity: Commodity;
  contract_month: string;
  quantity: number;
  price_snapshot: number;
}

export interface HedgeSessionItemCreate {
  commodity: Commodity;
  contract_month: string;
  quantity: number;
}

export interface HedgeSessionItemUpdate {
  quantity: number;
}

export interface HedgeSessionWithItems extends HedgeSession {
  items: HedgeSessionItem[];
}

// VaR Types
export interface CommodityVaR {
  sugar: number;
  flour: number;
  portfolio: number;
}

export interface VaRTimelinePoint {
  date: string;
  scenario: Scenario;
  var: CommodityVaR;
}

export interface VaRTimelineResponse {
  confidence_level: number;
  currency: string;
  timeline: VaRTimelinePoint[];
}

// Execute Hedge Types
export interface ExecuteHedgeResponse {
  status: "executed";
  executed_at: string;
  final_var: CommodityVaR;
}

// Upload Types
export interface UploadResponse {
  message: string;
  rows_processed: number;
  exposure_buckets_created?: number;
}

// Market Data Types
export interface FuturesContract {
  commodity: Commodity;
  contract_month: string;
  price: number;
  source: string;
}

export interface MarketDataRefreshResponse {
  message: string;
  commodities_updated: string[];
  prices_added: number;
  futures_contracts_updated: number;
}
