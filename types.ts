
export interface SalesData {
  date: string;
  product: string;
  unitsSold: number;
}

export interface InventoryData {
  product: string;
  currentStock: number;
  warehouse: string;
  safetyStock: number;
}

export interface SupplierData {
  supplierName: string;
  product: string;
  costPerUnit: number;
  reliability: 'High' | 'Medium' | 'Low';
  leadTimeDays: number;
}

export interface LogisticsData {
  route: string;
  distanceKm: number;
  avgDeliveryTimeDays: number;
  riskFactors: 'Traffic' | 'Weather' | 'None';
}

export interface ForecastResult {
  next7DaysDemand: number;
  explanation: string;
}

export interface RiskAnalysis {
  riskLevel: 'Low' | 'Medium' | 'High';
  daysToStockout: number;
  explanation: string;
}

export interface Recommendation {
  orderUnits: number;
  chosenSupplier: string;
  reason: string;
  orderTiming: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
