import { EMPLOYEES, type Employee } from '../data/employees'

type LoginResult = {
  email: string
  employee: Employee
}
const LoginApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new Error('Email et mot de passe requis')
    }

    const employee = EMPLOYEES.find((emp) => emp.email === email)

    if (!employee) {
      throw new Error('Employé introuvable')
    }

    if (employee.password !== password) {
      throw new Error('Mot de passe incorrect')
    }

    return {
      email,
      employee,
    }
  },
}

export default LoginApi