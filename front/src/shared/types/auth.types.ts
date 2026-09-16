export type UserRole = 
  | 'INDIVIDUAL' 
  | 'AGENT' 
  | 'AGENT_TUR_OPERATOR' 
  | 'CORPORATE' 
  | 'CORPORATE_HR' 
  | 'ADMIN' 
  | 'OPERATOR' 
  | 'MANAGER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  companyName?: string;
  agencyName?: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  passportNumber?: string;
  companyName?: string;
  agencyName?: string;
  licenseNumber?: string;
}
