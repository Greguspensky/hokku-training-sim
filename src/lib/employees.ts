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
    console.log('🆕 createEmployee called with data:', { name: data.name, company_id: data.company_id, manager_id: data.manager_id })

    // Don't set ID - let database auto-generate UUID
    const employeeData = {
      name: data.name,
      email: null, // NULL until invite is accepted
      company_id: data.company_id,
      manager_id: data.manager_id,
      invite_token: this.generateInviteToken(),
      is_active: true,
      has_joined: false,
      created_at: new Date().toISOString(),
      joined_at: null
    }

    console.log('💾 Attempting to insert employee into Supabase:', {
      name: employeeData.name,
      company_id: employeeData.company_id,
      invite_token: employeeData.invite_token
    })

    try {
      // Use admin client to bypass RLS (since this is called from API route without proper auth)
      const client = supabaseAdmin || supabase
      console.log('🔑 Using client for creation:', supabaseAdmin ? 'admin (bypasses RLS)' : 'regular (subject to RLS)')

      const { data: createdEmployee, error } = await client
        .from('employees')
        .insert([employeeData])
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating employee in Supabase:', error)
        // Fallback to memory storage for now - generate a demo UUID
        const demoEmployee: Employee = {
          ...employeeData,
          id: `demo-${crypto.randomUUID()}`, // Generate proper UUID for demo mode
          email: undefined,
          joined_at: undefined
        }
        demoEmployees.push(demoEmployee)
        console.log('🚧 Fallback to demo mode: Created employee invite:', {
          id: demoEmployee.id,
          name: demoEmployee.name,
          company_id: demoEmployee.company_id,
          invite_token: demoEmployee.invite_token
        })
        return demoEmployee
      }

      console.log('✅ Created employee in Supabase:', {
        id: createdEmployee.id,
        name: createdEmployee.name,
        company_id: createdEmployee.company_id,
        invite_token: createdEmployee.invite_token
      })

      return createdEmployee
    } catch (error) {
      console.error('Error creating employee:', error)
      // Fallback to memory storage - generate a demo UUID
      const demoEmployee: Employee = {
        ...employeeData,
        id: `demo-${crypto.randomUUID()}`, // Generate proper UUID for demo mode
        email: undefined,
        joined_at: undefined
      }
      demoEmployees.push(demoEmployee)
      console.log('🚧 Fallback to demo mode: Created employee invite:', {
        id: demoEmployee.id,
        name: demoEmployee.name,
        invite_token: demoEmployee.invite_token
      })
      return demoEmployee
    }
  }

  // Get employees for a manager
  async getEmployeesByManager(managerId: string, companyId: string): Promise<Employee[]> {
    console.log('🔍 getEmployeesByManager called with:', { managerId, companyId })

    try {
      // Use admin client to bypass RLS if available
      const client = supabaseAdmin || supabase
      console.log('🔑 Using client:', supabaseAdmin ? 'admin (bypasses RLS)' : 'regular (subject to RLS)')

      // Query 1: Get all employee invites from employees table (including pending)
      console.log('📊 Querying employees table for all invites (pending + accepted)...')
      const { data: employeeInvites, error: employeeError } = await client
        .from('employees')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (employeeError) {
        console.error('❌ Error fetching from employees table:', employeeError)
      } else {
        console.log('✅ Found employee invites:', employeeInvites?.length || 0)
      }

      // Query 2: Get accepted employees from users table for additional details
      console.log('📊 Querying users table for accepted employees...')
      const { data: users, error: userError } = await client
        .from('users')
        .select('*')
        .eq('role', 'employee')
        .eq('company_id', companyId)

      if (userError) {
        console.error('❌ Error fetching from users table:', userError)
      } else {
        console.log('✅ Found accepted employees in users table:', users?.length || 0)
      }

      // Merge the results
      const allEmployees: Employee[] = []

      // First, add all employee invites (both pending and accepted)
      if (employeeInvites && employeeInvites.length > 0) {
        for (const emp of employeeInvites) {
          // Check if this employee has accepted (exists in users table)
          const userRecord = users?.find(u => u.email === emp.email)

          allEmployees.push({
            id: emp.id,
            name: emp.name,
            email: emp.email || undefined,
            company_id: emp.company_id,
            manager_id: emp.manager_id,
            invite_token: emp.invite_token,
            is_active: emp.is_active,
            has_joined: emp.has_joined,
            created_at: emp.created_at,
            joined_at: emp.joined_at || undefined
          })
        }
      }

      // Then, add any users that don't have an employee record (edge case for legacy data)
      if (users && users.length > 0) {
        for (const user of users) {
          const alreadyAdded = allEmployees.find(e => e.email === user.email)
          if (!alreadyAdded) {
            // IMPORTANT: Look up the employee_id from employees table using user_id
            console.log(`🔍 Looking up employee record for user: ${user.email}`)
            const { data: employeeRecord, error: employeeRecordError } = await client
              .from('employees')
              .select('id')
              .eq('user_id', user.id)
              .single()

            if (employeeRecordError || !employeeRecord) {
              console.error(`❌ No employee record found for user ${user.email}, skipping`)
              continue // Skip users without employee records
            }

            allEmployees.push({
              id: employeeRecord.id, // Use employee_id from employees table
              name: user.name,
              email: user.email,
              company_id: companyId,
              manager_id: managerId,
              invite_token: '',
              is_active: true,
              has_joined: true,
              created_at: user.created_at,
              joined_at: user.created_at
            })
          }
        }
      }

      console.log('🎯 Returning total employees (pending + accepted):', allEmployees.length)
      console.log('   - Pending invites:', allEmployees.filter(e => !e.has_joined).length)
      console.log('   - Accepted employees:', allEmployees.filter(e => e.has_joined).length)

      return allEmployees
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
    console.log('🔍 Validating invite token:', token)

    try {
      // Query database first (using admin client to bypass RLS)
      const client = supabaseAdmin || supabase
      const { data: employee, error } = await client
        .from('employees')
        .select('*')
        .eq('invite_token', token)
        .eq('is_active', true)
        .eq('has_joined', false)
        .single()

      if (error || !employee) {
        console.log('❌ Token not found in database, checking in-memory fallback')

        // Fallback to in-memory storage
        const demoEmployee = demoEmployees.find(emp =>
          emp.invite_token === token &&
          emp.is_active &&
          !emp.has_joined
        )

        if (!demoEmployee) {
          console.log('❌ Token not found in either database or memory')
          return null
        }

        // Use demo employee
        console.log('✅ Found token in memory (demo mode)')
        return {
          employee_id: demoEmployee.id,
          employee_name: demoEmployee.name,
          company_id: demoEmployee.company_id,
          company_name: 'Demo Company',
          manager_id: demoEmployee.manager_id,
          is_valid: true
        }
      }

      console.log('✅ Found valid invite token in database:', {
        employee_id: employee.id,
        name: employee.name,
        company_id: employee.company_id
      })

      // Fetch actual company name from database
      let companyName = 'Unknown Company'
      try {
        const { data: company } = await client
          .from('companies')
          .select('name')
          .eq('id', employee.company_id)
          .single()

        if (company) {
          companyName = company.name
        }
      } catch (error) {
        console.error('Failed to fetch company name:', error)
      }

      return {
        employee_id: employee.id,
        employee_name: employee.name,
        company_id: employee.company_id,
        company_name: companyName,
        manager_id: employee.manager_id,
        is_valid: true
      }
    } catch (error) {
      console.error('Error validating invite token:', error)
      return null
    }
  }

  // Complete employee signup
  async completeEmployeeSignup(data: EmployeeSignupData): Promise<Employee | null> {
    try {
      // Use admin client to bypass RLS (since this is called during signup before proper auth)
      const client = supabaseAdmin || supabase
      console.log('🔑 Using client for signup completion:', supabaseAdmin ? 'admin (bypasses RLS)' : 'regular (subject to RLS)')

      // Update employee with email and mark as joined
      const { data: updatedEmployee, error } = await client
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
      // IMPORTANT: This function should not be used for company-specific operations
      // It's only for backward compatibility with legacy data
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        company_id: user.company_id || '', // Use actual company_id from user record
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