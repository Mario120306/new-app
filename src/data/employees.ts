export type Employee = {
  id: number
  email: string
  password: string // En production, ce serait un hash, ici c'est simplifié
  firstname: string
  lastname: string
}

export const EMPLOYEES: Employee[] = [
  {
    id: 1,
    email: 'admin@example.com',
    password: 'admin123',
    firstname: 'Admin',
    lastname: 'User',
  },
  {
    id: 2,
    email: 'mario@example.com',
    password: 'mario2006',
    firstname: 'Mario',
    lastname: 'Rana',
  },
  {
    id: 3,
    email: 'test@example.com',
    password: 'test123',
    firstname: 'Test',
    lastname: 'Employee',
  },
]
