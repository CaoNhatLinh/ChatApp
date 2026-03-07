// src/api/healthApi.ts

import api from '@/lib/axios';

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
  cassandra?: string;
  redis?: string;
}

export interface WebSocketInfo {
  endpoint: string;
  protocol: string;
  allowedOrigins: string;
  destinations: {
    subscribe: string[];
    send: string[];
  };
  instructions: {
    connect: string;
    authentication: string;
  };
}

/**
 * ❤️ Health check
 * Backend: GET /api/health
 */
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
};

/**
 * 🏓 Simple ping
 * Backend: GET /api/health/ping
 */
export const ping = async (): Promise<{ message: string; timestamp: string }> => {
  const response = await api.get<{ message: string; timestamp: string }>('/health/ping');
  return response.data;
};

/**
 * 🔌 WebSocket info
 * Backend: GET /api/health/websocket
 */
export const getWebSocketInfo = async (): Promise<WebSocketInfo> => {
  const response = await api.get<WebSocketInfo>('/health/websocket');
  return response.data;
};
