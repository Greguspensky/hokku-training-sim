# Employee Skill Comparison Feature
**Date**: 2025-11-14
**Status**: ✅ **COMPLETE**

## Overview
Added comprehensive employee skill comparison system that visualizes and ranks employee performance across all Service Practice sessions. The system provides both chart and table views with detailed metrics breakdown.

## Features

### 1. Employee Skill Comparison Chart
- **Visual Ranking**: Horizontal bar charts showing employee performance rankings
- **8 Metrics Tracking**:
  - Overall Average (composite score)
  - Empathy
  - Professionalism
  - Problem Resolution
  - Clarity
  - De-escalation
  - Product Knowledge Accuracy
  - Milestone Completion Rate

### 2. Two View Modes
- **Chart View**: Visual horizontal bars with color-coded performance indicators
- **Table View**: Comprehensive data grid showing all metrics for each employee

### 3. Company Statistics Dashboard
- **Total Employees**: Count of active employees with completed sessions
- **Company Average**: Overall performance average (only scenarios with >1 completion)
- **Best Performer**: Highlights top-performing employee
- **Distribution**: Breakdown by performance categories (Excellent/Good/Needs Work)

### 4. Performance Color Coding
- **Green (80-100)**: Excellent performance
- **Yellow (60-79)**: Good performance
- **Red (0-59)**: Needs improvement
- **Gray**: No data available

### 5. Smart Filtering
- **Automatic Exclusion**: Employees without completed Service Practice sessions are automatically excluded
- **Multi-Session Averaging**: Aggregates scores across multiple sessions per employee per metric

## Technical Implementation

### New Files Created

#### 1. `/src/app/api/employee-skill-comparison/route.ts` (244 lines)
**Purpose**: API endpoint that aggregates employee skill data from Service Practice sessions

**Key Features**:
- Fetches completed Service Practice sessions with assessment results
- Matches employees with users table via email (handles complex relationship chain)
- Calculates averages across 7 core metrics + milestone completion rate
- Ranks employees by overall performance
- Generates company-wide statistics

**Database Relationship Handling**:
```typescript
// Complex relationship: employees ↔ users (via email) ↔ training_sessions (via user_id)
// training_sessions.employee_id = users.id (NOT employees.id)

// Fetch employees
const { data: employeesRaw } = await supabaseAdmin
  .from('employees')
  .select('id, name, user_id, email')
  .eq('company_id', companyId)
  .eq('is_active', true)

// Fetch users separately
const { data: users } = await supabaseAdmin
  .from('users')
  .select('id, email')
  .eq('company_id', companyId)
  .eq('role', 'employee')

// Merge by email matching
const employees = employeesRaw?.map(emp => {
  const user = users?.find(u => u.email === emp.email)
  return {
    ...emp,
    user_id: emp.user_id || user?.id
  }
})

// Create lookup map
const userLookup = new Map(employees.map(e => [e.user_id, e.name]))

// Fetch sessions (employee_id is actually user_id)
const { data: sessions } = await supabaseAdmin
  .from('training_sessions')
  .select('id, employee_id, service_practice_assessment_results...')
  .eq('employee_id', employee_id) // This is users.id
```

**Metric Aggregation Logic**:
```typescript
// For each employee, aggregate metrics from all their sessions
sessions.forEach(session => {
  const results = session.service_practice_assessment_results as any

  // Add to running totals
  if (results.metrics.empathy !== undefined) {
    metrics.empathy.sum += results.metrics.empathy
    metrics.empathy.count++
  }
  // ... repeat for all metrics

  // Calculate milestone completion rate
  if (results.milestones && Array.isArray(results.milestones)) {
    const completed = results.milestones.filter(m => m.achieved).length
    const total = results.milestones.length
    const completionRate = total > 0 ? (completed / total) * 100 : 0
    metrics.milestone_completion_rate.sum += completionRate
    metrics.milestone_completion_rate.count++
  }
})

// Calculate averages (rounded to whole numbers)
const averages = {
  empathy: metrics.empathy.count > 0
    ? Math.round(metrics.empathy.sum / metrics.empathy.count)
    : null,
  // ... repeat for all metrics
}

// Calculate overall average (excluding null values)
const validMetrics = Object.values(averages).filter(v => v !== null)
const overallAverage = validMetrics.length > 0
  ? Math.round(validMetrics.reduce((sum, val) => sum + val, 0) / validMetrics.length)
  : 0
```

**Response Format**:
```typescript
{
  success: true,
  employees: [
    {
      employee_id: "uuid",
      employee_name: "John Doe",
      email: "john@example.com",
      sessions_completed: 5,
      overall_average: 75,
      rank: 1,
      metrics: {
        empathy: 80,
        professionalism: 75,
        problem_resolution: 70,
        clarity: 72,
        deescalation: 78,
        product_knowledge_accuracy: 85,
        milestone_completion_rate: 90
      }
    }
  ],
  company_stats: {
    total_employees: 6,
    total_sessions: 13,
    company_average: 72,
    best_performer: { employee_name: "John Doe", overall_average: 75 },
    distribution: {
      excellent: 1,  // >= 80
      good: 4,       // 60-79
      needs_work: 1  // < 60
    }
  }
}
```

#### 2. `/src/components/EmployeeSkillComparison.tsx` (430 lines)
**Purpose**: React component displaying employee skill comparison visualization

**Key Components**:

**State Management**:
```typescript
const [employees, setEmployees] = useState<EmployeeSkillData[]>([])
const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null)
const [selectedMetric, setSelectedMetric] = useState<MetricKey>('overall_average')
const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
```

**Metric Labels**:
```typescript
const METRIC_LABELS: Record<MetricKey, string> = {
  overall_average: 'Overall Average',
  empathy: 'Empathy',
  professionalism: 'Professionalism',
  problem_resolution: 'Problem Resolution',
  clarity: 'Clarity',
  deescalation: 'De-escalation',
  product_knowledge_accuracy: 'Product Knowledge',
  milestone_completion_rate: 'Milestone Completion'
}
```

**Color Coding Functions**:
```typescript
const getScoreColor = (score: number | null): string => {
  if (score === null) return 'bg-gray-300'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getScoreBadge = (score: number | null): string => {
  if (score === null) return 'N/A'
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  return 'Needs Work'
}
```

**Chart View Rendering**:
```typescript
{viewMode === 'chart' && sortedEmployees.map((employee, index) => (
  <div key={employee.employee_id} className="border rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
      <div className="flex-1">
        <p className="font-semibold text-gray-900">{employee.employee_name}</p>
        <p className="text-xs text-gray-500">
          {employee.sessions_completed} session{employee.sessions_completed !== 1 ? 's' : ''}
        </p>
      </div>
      <span className={`px-3 py-1 rounded-full ${getScoreBadgeColor(score)}`}>
        {getScoreBadge(score)}
      </span>
      <span className="text-lg font-bold">{score}/100</span>
    </div>
    {/* Horizontal progress bar */}
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div className={getScoreColor(score)}
           style={{width: `${percentage}%`}} />
    </div>
  </div>
))}
```

**Table View Rendering**:
```typescript
{viewMode === 'table' && (
  <table className="w-full">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Employee</th>
        <th>Sessions</th>
        <th>Overall</th>
        <th>Empathy</th>
        <th>Professional</th>
        <th>Resolution</th>
        <th>Clarity</th>
        <th>De-escalation</th>
        <th>Product Know.</th>
        <th>Milestones</th>
      </tr>
    </thead>
    <tbody>
      {employees.map(employee => (
        <tr key={employee.employee_id}>
          <td>#{employee.rank}</td>
          <td>{employee.employee_name}</td>
          <td>{employee.sessions_completed}</td>
          <td>
            <span className={getScoreBadgeColor(employee.overall_average)}>
              {employee.overall_average}
            </span>
          </td>
          {/* All individual metrics */}
        </tr>
      ))}
    </tbody>
  </table>
)}
```

**Company Statistics Cards**:
```typescript
<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
  {/* Total Employees */}
  <div className="bg-blue-50 rounded-lg p-4">
    <Users className="w-4 h-4 text-blue-600" />
    <p className="text-sm font-medium text-blue-900">Employees</p>
    <p className="text-2xl font-bold text-blue-600">{companyStats.total_employees}</p>
  </div>

  {/* Company Average */}
  <div className="bg-green-50 rounded-lg p-4">
    <TrendingUp className="w-4 h-4 text-green-600" />
    <p className="text-sm font-medium text-green-900">Company Average</p>
    <p className="text-2xl font-bold text-green-600">{companyStats.company_average}/100</p>
  </div>

  {/* Best Performer */}
  <div className="bg-purple-50 rounded-lg p-4">
    <Award className="w-4 h-4 text-purple-600" />
    <p className="text-sm font-medium text-purple-900">Best Performer</p>
    <p className="text-lg font-bold text-purple-600">{companyStats.best_performer?.employee_name}</p>
  </div>

  {/* Distribution */}
  <div className="bg-gray-50 rounded-lg p-4">
    <p className="text-sm font-medium text-gray-900">Distribution</p>
    <div className="flex gap-2 text-xs">
      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
        {companyStats.distribution.excellent} Excellent
      </span>
      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
        {companyStats.distribution.good} Good
      </span>
      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
        {companyStats.distribution.needs_work} Need Work
      </span>
    </div>
  </div>
</div>
```

### Modified Files

#### 3. `/src/app/manager/page.tsx`
**Changes**: Integrated EmployeeSkillComparison component into Progress tab

```typescript
// Added import (line 15)
import EmployeeSkillComparison from '@/components/EmployeeSkillComparison'

// Modified rendering in Progress tab (lines 969-974)
{selectedEmployee ? (
  <EmployeeDashboardView employee={selectedEmployee} />
) : (
  <>
    <EmployeeSkillComparison companyId={companyId} />
    <ServicePracticeAnalyticsDashboard companyId={companyId} />
  </>
)}
```

**Integration Pattern**:
- Component appears above ServicePracticeAnalyticsDashboard
- Shows "All Employees" view by default
- Switches to individual employee dashboard when employee is selected

#### 4. `/src/components/Manager/ServicePracticeAnalyticsDashboard.tsx`
**Changes**: Fixed Company Average calculation to only include scenarios with multiple completions

**Problem**: Company Average was including scenarios with only 1 completion (or even 0), skewing the average.

**Solution**: Filter to only include scenarios where `completion_count > 1`

```typescript
// BEFORE (lines 150-152):
const companyAvgScore = data.scenarios.length > 0
  ? Math.round(data.scenarios.reduce((sum, s) => sum + s.avg_score, 0) / data.scenarios.length)
  : 0

// AFTER (lines 149-154):
// Only include scenarios completed by more than 1 person for company average
const scenariosWithMultipleCompletions = data.scenarios.filter(s => s.completion_count > 1)
const companyAvgScore = scenariosWithMultipleCompletions.length > 0
  ? Math.round(scenariosWithMultipleCompletions.reduce((sum, s) => sum + s.avg_score, 0) / scenariosWithMultipleCompletions.length)
  : 0
```

**Impact**: Company Average now provides a more meaningful benchmark by excluding scenarios that haven't been attempted by multiple employees.

## Database Schema

### No Database Changes Required
This feature uses existing database tables and columns:

**Tables Used**:
- `training_sessions` - Source of Service Practice session data
  - `employee_id` (references `users.id`)
  - `service_practice_assessment_results` (JSONB with metrics)
  - `service_assessment_status`
  - `service_assessment_completed_at`
- `employees` - Employee information
  - `id`, `name`, `user_id`, `email`, `company_id`, `is_active`
- `users` - Authentication and user data
  - `id`, `email`, `company_id`, `role`

**Important Relationship**:
- `training_sessions.employee_id` = `users.id` (NOT `employees.id`)
- Match employees to users via `email` field
- This 3-table relationship requires careful handling in queries

## UI/UX Features

### 1. Empty States
```typescript
// No data available
if (employees.length === 0) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-600">No Service Practice data available yet</p>
      <p className="text-sm text-gray-500">
        Skill comparison will appear once employees complete Service Practice sessions
      </p>
    </div>
  )
}
```

### 2. Loading State
```typescript
if (loading) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}
```

### 3. Error State
```typescript
if (error) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-red-600">❌ {error}</p>
      <button onClick={loadSkillComparison} className="text-blue-600 underline">
        Try Again
      </button>
    </div>
  )
}
```

### 4. Interactive Elements
- **View Mode Toggle**: Switch between Chart and Table views
- **Metric Selector**: Dropdown to select which metric to compare
- **Dynamic Sorting**: Employees automatically re-sorted when metric changes
- **Color-Coded Indicators**: Immediate visual feedback on performance levels
- **Session Count**: Shows how many sessions contributed to each employee's scores

### 5. Responsive Design
- **Mobile-First**: Tailwind CSS classes ensure mobile compatibility
- **Grid Layouts**: Responsive grid for statistics cards (1 column on mobile, 4 on desktop)
- **Horizontal Scroll**: Table view scrolls horizontally on smaller screens
- **Truncated Text**: Long employee names truncate with ellipsis

## Testing Checklist

### Functional Testing
- [x] API correctly fetches and aggregates employee data
- [x] Complex database relationship (employees ↔ users ↔ training_sessions) handled correctly
- [x] Employees without sessions are excluded
- [x] Multi-session averaging works correctly
- [x] Overall average calculated correctly (excludes null metrics)
- [x] Company statistics calculated correctly
- [x] Ranking system works (sorted by overall_average descending)
- [x] Company Average only includes scenarios with >1 completion

### UI Testing
- [x] Chart view displays correctly
- [x] Table view displays correctly
- [x] View mode toggle works
- [x] Metric selector updates display
- [x] Dynamic sorting works when metric changes
- [x] Loading state displays during data fetch
- [x] Error state displays on API failure
- [x] Empty state displays when no data available
- [x] Company statistics cards display correctly
- [x] Color coding matches score ranges
- [x] Responsive design works on different screen sizes

### Integration Testing
- [x] Component integrates correctly into manager dashboard
- [x] Appears in correct tab (Progress)
- [x] Coexists with ServicePracticeAnalyticsDashboard
- [x] Switches properly when employee is selected
- [x] Data refreshes when company_id changes

## Performance Considerations

### Optimization Strategies
1. **Single API Call**: All data fetched in one request
2. **Client-Side Sorting**: Re-sorting when metric changes doesn't require new API call
3. **Memoization**: React component only re-renders when dependencies change
4. **Database Indexes**: Leverages existing indexes on:
   - `training_sessions.company_id`
   - `training_sessions.employee_id`
   - `training_sessions.service_assessment_status`
   - `employees.company_id`
   - `users.company_id`

### Scalability
- **Current Load**: Handles 6 employees × 15 scenarios = 90 data points efficiently
- **Expected Load**: Should handle up to 100 employees × 50 scenarios = 5,000 data points
- **Potential Bottleneck**: Very large companies (500+ employees) may need pagination
- **Future Enhancement**: Add pagination or filtering for large datasets

## Troubleshooting Guide

### Issue: "Failed to fetch sessions" Error
**Cause**: Database relationship error (PGRST200)
**Solution**: Ensure query doesn't try to join `training_sessions` with `employees` directly. Use separate queries and merge in memory.

### Issue: "No Service Practice data available" with existing data
**Cause**: User lookup failing due to missing columns or incorrect email matching
**Solution**:
1. Verify `users` table query only requests existing columns (`id`, `email`)
2. Check email matching between `employees` and `users` tables
3. Verify `employee.user_id` is properly set or can be matched via email

### Issue: Company Average doesn't match expectations
**Cause**: Including scenarios with only 1 or 0 completions
**Solution**: Ensure calculation filters to `completion_count > 1`

### Issue: Missing employees in comparison
**Cause**: Employees without `user_id` or completed sessions
**Solution**:
1. Check `employees.user_id` is set
2. Verify email matching logic
3. Confirm sessions have `service_assessment_status = 'completed'`
4. Ensure `service_practice_assessment_results` is not null

## Future Enhancements

### Potential Improvements
1. **Individual Metric Charts**: Separate chart for each metric showing all employees
2. **Trend Analysis**: Show performance trends over time
3. **Peer Comparison**: Allow employees to see how they rank against peers
4. **Export Functionality**: Export data to CSV/Excel for further analysis
5. **Filtering Options**: Filter by date range, scenario type, or performance level
6. **Drill-Down**: Click on employee to see detailed session breakdown
7. **Benchmarking**: Compare against industry standards or other companies
8. **Coaching Recommendations**: AI-generated suggestions based on weak areas

### Advanced Features
1. **Real-Time Updates**: WebSocket integration for live score updates
2. **Gamification**: Badges, achievements, leaderboards
3. **Custom Metrics**: Allow managers to define custom performance metrics
4. **Team Comparisons**: Compare different teams or departments
5. **Skill Gaps Analysis**: Identify company-wide areas needing training focus

## Related Documentation
- **SERVICE_PRACTICE_ANALYSIS_2025-11-09.md** - Service Practice assessment system
- **API_REFERENCE.md** - Complete API endpoint documentation
- **DATABASE_REFERENCE.md** - Full database schema reference
- **TROUBLESHOOTING_GUIDE.md** - Common issues and solutions

## Conclusion

The Employee Skill Comparison feature provides managers with powerful insights into employee performance across Service Practice sessions. The dual-view system (chart and table) accommodates different analysis needs, while the comprehensive metrics breakdown enables targeted coaching and training interventions.

**Status**: ✅ **PRODUCTION READY**

**Files Modified**: 4 files (1 API route, 2 components, 1 page integration)
**Lines of Code**: ~670 lines total
**Testing Status**: Fully tested and working
**Performance**: Optimized for companies with up to 100 employees
