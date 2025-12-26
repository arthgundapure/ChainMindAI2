
import { SalesData, InventoryData, SupplierData, LogisticsData } from './types';

export const SALES_DATA: SalesData[] = [
  { date: '2023-10-14', product: 'Shampoo', unitsSold: 110 },
  { date: '2023-10-15', product: 'Shampoo', unitsSold: 115 },
  { date: '2023-10-16', product: 'Shampoo', unitsSold: 125 },
  { date: '2023-10-17', product: 'Shampoo', unitsSold: 140 },
  { date: '2023-10-18', product: 'Shampoo', unitsSold: 155 },
  { date: '2023-10-19', product: 'Shampoo', unitsSold: 160 },
  { date: '2023-10-20', product: 'Shampoo', unitsSold: 175 },
  { date: '2023-10-21', product: 'Shampoo', unitsSold: 190 },
  { date: '2023-10-22', product: 'Shampoo', unitsSold: 210 },
  { date: '2023-10-23', product: 'Shampoo', unitsSold: 220 },
  { date: '2023-10-24', product: 'Shampoo', unitsSold: 235 },
  { date: '2023-10-25', product: 'Shampoo', unitsSold: 245 },
  { date: '2023-10-26', product: 'Shampoo', unitsSold: 255 },
  { date: '2023-10-27', product: 'Shampoo', unitsSold: 270 },
];

export const INVENTORY_DATA: InventoryData[] = [
  { product: 'Shampoo', currentStock: 850, warehouse: 'Mumbai_WH_01', safetyStock: 300 },
];

export const SUPPLIER_DATA: SupplierData[] = [
  { supplierName: 'Apex Chem-Tech', product: 'Shampoo', costPerUnit: 120, reliability: 'High', leadTimeDays: 10 },
  { supplierName: 'Local Fresh Supply', product: 'Shampoo', costPerUnit: 145, reliability: 'Medium', leadTimeDays: 2 },
];

export const LOGISTICS_DATA: LogisticsData[] = [
  { route: 'Western Highway', distanceKm: 450, avgDeliveryTimeDays: 1, riskFactors: 'Traffic' },
  { route: 'Expressway Direct', distanceKm: 420, avgDeliveryTimeDays: 1, riskFactors: 'None' },
  { route: 'Coastal Road', distanceKm: 500, avgDeliveryTimeDays: 2, riskFactors: 'Weather' },
];

export const APP_CONFIG = {
  MODELS: {
    text: 'gemini-3-flash-preview',
  }
};
