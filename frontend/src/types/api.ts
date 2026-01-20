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
  username: string;
  customer_name: string;
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

export interface CommodityCost {
  sugar: number;
  flour: number;
  portfolio: number;
}

export interface VaRTimelinePoint {
  date: string;
  scenario: Scenario;
  expected_cost: CommodityCost;
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

// VaR Preview Types (NEW per AGENTS.md 10.9)
export interface VarPreviewRequest {
  commodity: Commodity;
  contract_month: string;
  quantity: number;
}

export interface VarPreviewResponse {
  delta_var: CommodityVaR;
  preview_var: CommodityVaR;
}

// Price Projection Types (NEW - simpler visualization)
export interface PricePoint {
  date: string;
  price: number;
  high_future: number;
  low_future: number;
  is_past: boolean;
}

export interface CommodityProjection {
  commodity: Commodity;
  timeline: PricePoint[];
}

export interface PriceProjectionResponse {
  currency: string;
  projections: CommodityProjection[];
}

// Futures Contracts Types (NEW - for tiles)
export interface FutureContract {
  commodity: string;
  contract_month: string;  // YYYY-MM-DD
  price: number;
  future_type: 'high' | 'low';
}

export interface FuturesListResponse {
  futures: FutureContract[];
}

// Data Status Types (NEW)
export interface DatasetStatus {
  uploaded: boolean;
  record_count: number;
  last_uploaded_at: string | null;
}

export interface MarketDataStatus {
  available: boolean;
  record_count: number;
  last_refreshed_at: string | null;
  source: string;
}

export interface DataStatusResponse {
  purchases: DatasetStatus;
  inventory: DatasetStatus;
  market_data: MarketDataStatus;
}

// Portfolio Types (NEW per AGENTS.md 10.10)
export interface ExecutedHedge {
  id: string;
  commodity: Commodity;
  contract_month: string;
  quantity: number;
  execution_price: number;
  execution_date: string;
  value: number;
  status: 'active' | 'expired';
}

export interface CommodityBreakdown {
  total_quantity: number;
  total_value: number;
  contracts: number;
}

export interface PortfolioSummary {
  total_positions: number;
  total_quantity: number;
  total_value: number;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  hedges: ExecutedHedge[];
  breakdown: {
    sugar: CommodityBreakdown;
    flour: CommodityBreakdown;
  };
}

// Upload Types
export interface UploadResponse {
  message: string;
  rows_processed: number;
  exposure_buckets_created?: number;
}

// Market Data Types (UPDATED per AGENTS.md 10.8)
export interface FuturesContract {
  commodity: Commodity;
  contract_month: string;
  price: number;
  contract_unit: number;           // NEW: Numeric contract size (e.g., 50000)
  contract_unit_label: string;     // NEW: Display string (e.g., "50k lbs")
  notional: number;                // NEW: price * contract_unit
  source: string;
}

export interface MarketDataRefreshResponse {
  message: string;
  commodities_updated: string[];
  prices_added: number;
  futures_contracts_updated: number;
}
