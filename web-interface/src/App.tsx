import { createBrowserRouter, RouterProvider, Outlet, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './contexts/ThemeContext'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Automations from './pages/Automations'
import CreateAutomation from './pages/CreateAutomation'
import Credentials from './pages/Credentials'
import PromptLibrary from './pages/PromptLibrary'
import PersonalSettings from './pages/PersonalSettings'
import Login from './pages/Login'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Error boundary component
function ErrorBoundary() {
  const error = useRouteError();
  
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
            <a href="/" className="text-blue-500 hover:underline">Go back home</a>
          </div>
        </div>
      );
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Oops!</h1>
        <p className="text-gray-600 mb-4">Something went wrong.</p>
        <pre className="text-left bg-gray-100 p-4 rounded">
          {error instanceof Error ? error.message : 'Unknown error'}
        </pre>
      </div>
    </div>
  );
}

// Root layout component
function RootLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

// Create router with future flags
const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'automations',
        element: <Automations />,
      },
      {
        path: 'create',
        element: <CreateAutomation />,
      },
      {
        path: 'credentials',
        element: <Credentials />,
      },
      {
        path: 'prompts',
        element: <PromptLibrary />,
      },
      {
        path: 'settings',
        element: <PersonalSettings />,
      },
      {
        path: '*',
        element: <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
            <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
            <a href="/" className="text-blue-500 hover:underline">Go back home</a>
          </div>
        </div>,
      },
    ],
  },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
    v7_startTransition: true,
  },
})

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <RouterProvider router={router} />
          <Toaster 
            position="top-right"
            toastOptions={{
              className: '',
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </WorkspaceProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App