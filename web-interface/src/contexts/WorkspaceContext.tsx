import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { workspaceAPI } from '../services/api'
import { toast } from 'react-hot-toast'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  role: 'admin' | 'editor' | 'viewer'
  permissions: {
    canCreateWorkflows: boolean
    canEditWorkflows: boolean
    canDeleteWorkflows: boolean
    canExecuteWorkflows: boolean
    canManageCredentials: boolean
    canInviteMembers: boolean
  }
  createdAt: string
  updatedAt: string
}

interface WorkspaceContextType {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  loading: boolean
  error: string | null
  selectWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}

interface WorkspaceProviderProps {
  children: ReactNode
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshWorkspaces = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await workspaceAPI.list()
      
      if (response.success && response.data) {
        setWorkspaces(response.data)
        
        // If no current workspace is selected, select the first one
        if (!currentWorkspace && response.data.length > 0) {
          const savedWorkspaceId = localStorage.getItem('current_workspace_id')
          const savedWorkspace = response.data.find((w: Workspace) => w.id === savedWorkspaceId)
          
          if (savedWorkspace) {
            setCurrentWorkspace(savedWorkspace)
          } else {
            setCurrentWorkspace(response.data[0])
            localStorage.setItem('current_workspace_id', response.data[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err)
      setError('Failed to load workspaces')
      toast.error('Failed to load workspaces')
    } finally {
      setLoading(false)
    }
  }

  const selectWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (workspace) {
      setCurrentWorkspace(workspace)
      localStorage.setItem('current_workspace_id', workspaceId)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      refreshWorkspaces()
    } else {
      setLoading(false)
    }
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        loading,
        error,
        selectWorkspace,
        refreshWorkspaces
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}