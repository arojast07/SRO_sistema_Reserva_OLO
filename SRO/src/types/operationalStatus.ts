export interface OperationalStatus {
  id: string;
  org_id: string;
  name: string;
  code: string;
  color: string;
  order_index: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
}

export interface CreateOperationalStatusDto {
  name: string;
  code: string;
  color: string;
  order_index: number;
}

export interface UpdateOperationalStatusDto {
  name?: string;
  code?: string;
  color?: string;
  order_index?: number;
  is_active?: boolean;
}
