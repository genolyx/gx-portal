export type ClientType = 'Managing' | 'Service';
export type SequencingDataMethod = 'Remote' | 'Local';

export interface Client {
  id: number;
  name: string;
  /** Two-letter order ID prefix, e.g. GX for Genolyx */
  order_prefix?: string;
  address?: string;
  email?: string;
  phone?: string;
  language?: string;
  type: ClientType;
  sequencing_data_method: SequencingDataMethod;
  is_managing_hospitals: boolean;
  auto_approve_orders: boolean;
  sign_report: boolean;
  service_codes: string[]; // allowed services
  created_at: string;
}

export interface CreateClientDto {
  name: string;
  order_prefix?: string;
  address?: string;
  email?: string;
  phone?: string;
  language?: string;
  type?: ClientType;
  sequencing_data_method?: SequencingDataMethod;
  is_managing_hospitals?: boolean;
  auto_approve_orders?: boolean;
  sign_report?: boolean;
  service_codes?: string[];
}

export type UpdateClientDto = Partial<CreateClientDto>;

export interface Lab {
  id: number;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  client_id?: number;
  client_name?: string; // joined
  service_codes: string[]; // allowed services
  created_at: string;
}

export interface CreateLabDto {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  client_id?: number;
  service_codes?: string[];
}

export type UpdateLabDto = Partial<CreateLabDto>;

export type UserRole = 'admin' | 'client' | 'lab';

export interface UserProfile {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  role: UserRole;
  client_id?: number;
  client_name?: string;
  lab_id?: number;
  lab_name?: string;
  email_notification: boolean;
  created_at: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: UserRole;
  client_id?: number;
  lab_id?: number;
  email_notification?: boolean;
}

export type UpdateUserDto = Partial<Omit<CreateUserDto, 'password'>> & {
  password?: string;
};

export interface DaemonService {
  code: string;
  name?: string;
  description?: string;
}
