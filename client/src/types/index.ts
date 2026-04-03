// src/types/index.ts
// All shared TypeScript types in one place.
// These match exactly what the API returns.

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Url {
  id: string;
  shortCode: string;
  originalUrl: string;
  customAlias: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  _count?: { clicks: number };
}

export interface UrlsResponse {
  urls: Url[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AnalyticsSummary {
  totalClicks: number;
  uniqueVisitors: number;
  topCountries: { country: string; clicks: number }[];
  topDevices: { device: string; clicks: number }[];
}

export interface TimelinePoint {
  date: string;
  clicks: number;
}

export interface TimelineResponse {
  timeline: TimelinePoint[];
}

export interface GeoPoint {
  country: string;
  clicks: number;
}

export interface DevicePoint {
  device: string;
  clicks: number;
}

// API error shape
export interface ApiError {
  error: string;
}