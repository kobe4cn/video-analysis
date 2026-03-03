export interface ModelProviderItem {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  modelCount: number;
  createdAt: string;
}

export interface CreateModelProviderRequest {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface UpdateModelProviderRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  isActive?: boolean;
}

export interface ModelItem {
  id: string;
  name: string;
  displayName: string;
  providerId: string;
  providerName: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
}

export interface CreateModelRequest {
  name: string;
  displayName: string;
  providerId: string;
  config?: Record<string, unknown>;
}

export interface UpdateModelRequest {
  name?: string;
  displayName?: string;
  isActive?: boolean;
  config?: Record<string, unknown>;
}
