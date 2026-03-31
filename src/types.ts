export type UserRole = 'admin' | 'vigilante';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive?: boolean;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  qrValue: string;
  createdAt: string;
}

export interface ScanLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  locationId: string;
  locationName: string;
  timestamp: string;
}
