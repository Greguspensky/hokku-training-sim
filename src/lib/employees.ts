import { supabase, supabaseAdmin } from '@/lib/supabase'

export interface Employee {
  id: string
  name: string
  email?: string
  company_id: string
  manager_id: string
  invite_token: string
  is_active: boolean
  has_joined: boolean
  created_at: string
  joined_at?: string
}

export interface CreateEmployeeData {
  name: string
  company_id: string
  manager_id: string
}

export interface EmployeeSignupData {
  email: string
  password: string
  invite_token: string
}

export interface InviteTokenData {
  employee_id: string
  employee_name: string
  company_id: string
  company_name?: string
  manager_id: string
  is_valid: boolean
}

// Demo storage for development
const demoEmployees: Employee[] = globalThis.__demoEmployeesStore || []

// Persist demo data across hot reloads
globalThis.__demoEmployeesStore = demoEmployees

class EmployeeService {
  // Generate secure invite token
  private generateInviteToken(): string {
    return 'invite-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15)
  }

  // Create new employee (manager action)
  async createEmployee(data: CreateEmployeeData): Promise<Employee> {
    const employee: Employee = {
      id: `demo-employee-${Date.now()}`,
      name: data.name,
      email: undefined,
      company_id: data.company_id,
      manager_id: data.manager_id,
      invite_token: this.generateInviteToken(),
      is_active: true,
      has_joined: false,
      created_at: new Date().toISOString(),
      joined_at: undefined
    }

    try {
      const { data: createdEmployee, error } = await supabase
        .from('employees')
        .insert([employee])
        .select()
        .single()

      if (error) {
        console.error('Error creating employee in Supabase:', error)
        // Fallback to memory storage for now
        demoEmployees.push(employee)
        console.log('🚧 Fallback to demo mode: Created employee invite:', {
          id: employee.id,
          name: employee.name,
          invite_token: employee.invite_token
        })
        return employee
      }

      console.log('✅ Created employee in Supabase:', {
        id: createdEmployee.id,
        name: createdEmployee.name,
        invite_token: createdEmployee.invite_token
      })

      return createdEmployee
    } catch (error) {
      console.error('Error creating employee:', error)
      // Fallback to memory storage
      demoEmployees.push(employee)
      console.log('🚧 Fallback to demo mode: Created employee invite:', {
        id: employee.id,
        name: employee.name,
        invite_token: employee.invite_token
      })
      return employee
    }
  }

  // Get employees for a manager
  async getEmployeesByManager(managerId: string, companyId: string): Promise<Employee[]> {
    console.log('🔍 getEmployeesByManager called with:', { managerId, companyId })

    try {
      console.log('📊 Querying users table for employees...')

      // Use admin client to bypass RLS if available
      const client = supabaseAdmin || supabase
      console.log('🔑 Using client:', supabaseAdmin ? 'admin (bypasses RLS)' : 'regular (subject to RLS)')

      // Query users table for all employees
      const { data: users, error } = await client
        .from('users')
        .select('*')
        .eq('role', 'employee')

      console.log('📋 Supabase query result:', { users: users?.length, error: error?.message })

      if (error) {
        console.error('❌ Error fetching employees from users table:', error)
        return []
      }

      if (!users || users.length === 0) {
        console.log('⚠️ No employees found in users table')
        return []
      }

      console.log('✅ Found employees in users table:', users.map(u => ({ email: u.email, name: u.name, role: u.role })))

      // Convert users to employee format for compatibility
      const employees: Employee[] = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        company_id: companyId,
        manager_id: managerId,
        invite_token: '',
        is_active: true,
        has_joined: true,
        created_at: user.created_at,
        joined_at: user.created_at
      }))

      console.log('🎯 Returning employees:', employees.length)
      return employees
    } catch (error) {
      console.error('💥 Error in getEmployeesByManager:', error)
      return []
    }
  }

  // Get employee by ID
  async getEmployee(id: string): Promise<Employee | null> {
    const employee = demoEmployees.find(emp => emp.id === id && emp.is_active)
    return employee || null
  }

  // Validate invite token
  async validateInviteToken(token: string): Promise<InviteTokenData | null> {
    const employee = demoEmployees.find(emp => 
      emp.invite_token === token && 
      emp.is_active &&
      !emp.has_joined
    )
    
    if (!employee) {
      return null
    }

    return {
      employee_id: employee.id,
      employee_name: employee.name,
      company_id: employee.company_id,
      company_name: 'Demo Company', // In real app, would fetch from company table
      manager_id: employee.manager_id,
      is_valid: true
    }
  }

  // Complete employee signup
  async completeEmployeeSignup(data: EmployeeSignupData): Promise<Employee | null> {
    try {
      // Update employee with email and mark as joined
      const { data: updatedEmployee, error } = await supabase
        .from('employees')
        .update({
          email: data.email,
          has_joined: true,
          joined_at: new Date().toISOString()
        })
        .eq('invite_token', data.invite_token)
        .eq('is_active', true)
        .eq('has_joined', false)
        .select()
        .single()

      if (error) {
        console.error('Error updating employee in Supabase:', error)
        // Fallback to memory storage
        const employeeIndex = demoEmployees.findIndex(emp =>
          emp.invite_token === data.invite_token &&
          emp.is_active &&
          !emp.has_joined
        )

        if (employeeIndex === -1) {
          throw new Error('Invalid or expired invite token')
        }

        demoEmployees[employeeIndex] = {
          ...demoEmployees[employeeIndex],
          email: data.email,
          has_joined: true,
          joined_at: new Date().toISOString()
        }

        console.log('🚧 Fallback to demo mode: Employee completed signup:', {
          id: demoEmployees[employeeIndex].id,
          name: demoEmployees[employeeIndex].name,
          email: data.email
        })

        return demoEmployees[employeeIndex]
      }

      console.log('✅ Employee completed signup in Supabase:', {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        email: data.email
      })

      return updatedEmployee
    } catch (error) {
      console.error('Error completing employee signup:', error)
      throw new Error('Invalid or expired invite token')
    }
  }

  // Delete employee (manager action)
  async deleteEmployee(id: string, managerId: string): Promise<void> {
    const employeeIndex = demoEmployees.findIndex(emp => 
      emp.id === id && 
      emp.manager_id === managerId &&
      emp.is_active
    )
    
    if (employeeIndex !== -1) {
      // Soft delete by marking inactive
      demoEmployees[employeeIndex].is_active = false
      console.log('🚧 Demo mode: Deleted employee:', demoEmployees[employeeIndex].name)
    }
  }

  // Regenerate invite token
  async regenerateInviteToken(id: string, managerId: string): Promise<Employee | null> {
    const employeeIndex = demoEmployees.findIndex(emp => 
      emp.id === id && 
      emp.manager_id === managerId &&
      emp.is_active
    )
    
    if (employeeIndex === -1) {
      return null
    }

    // Generate new token
    demoEmployees[employeeIndex].invite_token = this.generateInviteToken()
    
    console.log('🚧 Demo mode: Regenerated invite token for:', demoEmployees[employeeIndex].name)
    
    return demoEmployees[employeeIndex]
  }

  // Get invite link for employee
  getInviteLink(employee: Employee, baseUrl: string = 'http://localhost:3001'): string {
    return `${baseUrl}/join/${employee.invite_token}`
  }

  // Search employees
  async searchEmployees(managerId: string, companyId: string, query: string): Promise<Employee[]> {
    const employees = await this.getEmployeesByManager(managerId, companyId)

    if (!query.trim()) {
      return employees
    }

    const searchTerm = query.toLowerCase()
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(searchTerm) ||
      (emp.email && emp.email.toLowerCase().includes(searchTerm))
    )
  }

  // Check if user is an employee by email
  async isEmployee(email: string): Promise<boolean> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('role')
        .eq('email', email)
        .single()

      if (error) {
        console.log('User lookup error (likely no matching record):', error.message)
        return false
      }

      return user?.role === 'employee'
    } catch (error) {
      console.error('Error checking employee status:', error)
      return false
    }
  }

  // Get employee by email
  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('role', 'employee')
        .single()

      if (error) {
        console.log('Employee lookup by email error:', error.message)
        return null
      }

      // Convert user to employee format for compatibility
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        company_id: '01f773e2-1027-490e-8d36-279136700bbf', // Default for now
        manager_id: 'demo-manager-1', // Default for now
        invite_token: '',
        is_active: true,
        has_joined: true,
        created_at: user.created_at,
        joined_at: user.created_at
      }
    } catch (error) {
      console.error('Error getting employee by email:', error)
      return null
    }
  }
}

export const employeeService = new EmployeeService()