export interface RemoteApiConfig {
  port: number;
  host: string;
  requestTimeout: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const defaultConfig: RemoteApiConfig = {
  port: 3000,
  host: 'localhost',
  requestTimeout: 10000,
  reconnectAttempts: 3,
  reconnectDelay: 1000,
  logLevel: 'info',
};
