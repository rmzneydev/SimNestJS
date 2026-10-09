export type Role = 'admin' | 'supervisor' | 'asesor';

export interface AuthUser {
  username: string;
  role: Role;
}

// Usuarios de prueba en memoria: la clave es el valor del encabezado x-user.
export const USERS: Record<string, Role> = {
  admin1: 'admin',
  super1: 'supervisor',
  ana: 'asesor',
  luis: 'asesor',
};
