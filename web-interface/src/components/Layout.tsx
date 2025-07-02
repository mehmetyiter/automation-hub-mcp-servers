import { ReactNode, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, 
  Workflow, 
  Plus, 
  Settings, 
  Zap,
  Bot,
  Cpu,
  Globe,
  ChevronRight,
  Key,
  BookOpen,
  LogOut,
  User
} from 'lucide-react'
import clsx from 'clsx'
import ThemeToggle from './ThemeToggle'
import { authAPI } from '../services/api'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Automations', href: '/automations', icon: Workflow },
  { name: 'Create New', href: '/create', icon: Plus },
  { name: 'Prompt Library', href: '/prompts', icon: BookOpen },
  { name: 'Credentials', href: '/credentials', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const platforms = [
  { name: 'n8n', icon: Cpu, color: 'text-orange-500' },
  { name: 'Make', icon: Globe, color: 'text-purple-500' },
  { name: 'Zapier', icon: Zap, color: 'text-amber-500' },
  { name: 'Vapi', icon: Bot, color: 'text-blue-500' },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await authAPI.logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      // Even if logout fails, clear local storage and redirect
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      localStorage.removeItem('current_workspace_id')
      navigate('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }
  
  // Get user info from localStorage
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-card shadow-sm dark:shadow-none dark:border-r dark:border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b dark:border-border">
            <Cpu className="h-8 w-8 text-primary-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-foreground">Automation Hub</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary/10 text-primary-700 dark:text-primary'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  )}
                >
                  <item.icon
                    className={clsx(
                      'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                      isActive
                        ? 'text-primary-600 dark:text-primary'
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                    )}
                  />
                  {item.name}
                  {item.name === 'Create New' && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Platform Status */}
          <div className="border-t dark:border-border px-4 py-4">
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Connected Platforms
            </h3>
            <div className="mt-3 space-y-1">
              {platforms.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center px-3 py-2 text-sm"
                >
                  <platform.icon className={clsx('h-4 w-4 mr-2', platform.color)} />
                  <span className="text-gray-700 dark:text-gray-300">{platform.name}</span>
                  <span className="ml-auto h-2 w-2 rounded-full bg-green-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {/* Header Bar */}
        <header className="h-16 bg-white dark:bg-card border-b dark:border-border px-8 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-foreground">
            Welcome back{user?.username ? `, ${user.username}` : ''}
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            {/* User Menu */}
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <User className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
              )}
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 
                         hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}