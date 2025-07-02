import { useState } from 'react'
import { Play, Pause, Trash2, Edit, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { listAutomations } from '../services/api'

const platformColors = {
  n8n: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
  make: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
  zapier: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  vapi: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
}

export default function Automations() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations', selectedPlatform],
    queryFn: () => listAutomations(selectedPlatform === 'all' ? undefined : selectedPlatform),
  })

  const filteredAutomations = automations.filter((automation: any) =>
    automation.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">Automations</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your automations across all platforms</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search automations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
        />
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
        >
          <option value="all">All Platforms</option>
          <option value="n8n">n8n</option>
          <option value="make">Make</option>
          <option value="zapier">Zapier</option>
          <option value="vapi">Vapi</option>
        </select>
      </div>

      {/* Automations List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-card shadow dark:shadow-none dark:border dark:border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-border">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                {filteredAutomations.map((automation: any) => (
                  <tr key={automation.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-foreground">
                          {automation.name}
                        </div>
                        {automation.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {automation.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        platformColors[automation.platform as keyof typeof platformColors] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}>
                        {automation.platform}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        automation.active
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                      }`}>
                        {automation.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {automation.lastRun || 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          title={automation.active ? 'Pause' : 'Play'}
                        >
                          {automation.active ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Open in platform"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredAutomations.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No automations found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}