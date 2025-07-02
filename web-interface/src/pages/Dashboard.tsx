import { 
  Workflow, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Clock,
  Activity
} from 'lucide-react'

const stats = [
  { name: 'Total Automations', value: '127', icon: Workflow, change: '+12%', changeType: 'positive' },
  { name: 'Active Workflows', value: '89', icon: Activity, change: '+8%', changeType: 'positive' },
  { name: 'Executions Today', value: '3,426', icon: Zap, change: '+23%', changeType: 'positive' },
  { name: 'Success Rate', value: '98.2%', icon: CheckCircle, change: '-0.3%', changeType: 'negative' },
]

const recentActivity = [
  { id: 1, name: 'Customer Welcome Email', platform: 'n8n', status: 'success', time: '2 minutes ago' },
  { id: 2, name: 'CRM Data Sync', platform: 'Make', status: 'success', time: '5 minutes ago' },
  { id: 3, name: 'Sales Call Scheduler', platform: 'Vapi', status: 'running', time: '10 minutes ago' },
  { id: 4, name: 'Invoice Processing', platform: 'n8n', status: 'failed', time: '15 minutes ago' },
  { id: 5, name: 'Slack Notifications', platform: 'Zapier', status: 'success', time: '20 minutes ago' },
]

export default function Dashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">Dashboard</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Monitor your automation performance across all platforms</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="overflow-hidden rounded-lg bg-white dark:bg-card shadow dark:shadow-none dark:border dark:border-border hover:shadow-md dark:hover:shadow-none transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-8 w-8 text-primary-600 dark:text-primary" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-foreground">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center text-sm">
                  <TrendingUp className={`h-4 w-4 ${
                    stat.changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                  }`} />
                  <span className={`ml-1 ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.change}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">from last week</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-4">Recent Activity</h2>
        <div className="overflow-hidden bg-white dark:bg-card shadow dark:shadow-none dark:border dark:border-border rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-border">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Automation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                {recentActivity.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-foreground">
                      {activity.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                        {activity.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activity.status === 'success' 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                          : activity.status === 'running'
                          ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                      }`}>
                        {activity.status === 'running' && <Clock className="mr-1 h-3 w-3" />}
                        {activity.status === 'failed' && <AlertCircle className="mr-1 h-3 w-3" />}
                        {activity.status === 'success' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {activity.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}