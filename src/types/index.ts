export type RolUsuario = 'admin' | 'empleado';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  role: RolUsuario;
}