// Common theme classes for consistent styling across the app
export const theme = {
  // Card styles
  card: 'bg-white dark:bg-card shadow dark:shadow-none dark:border dark:border-border',
  cardHover: 'hover:shadow-md dark:hover:shadow-none',
  
  // Text styles
  heading: 'text-gray-900 dark:text-foreground',
  subheading: 'text-gray-600 dark:text-gray-400',
  muted: 'text-gray-500 dark:text-gray-400',
  
  // Button styles
  button: {
    primary: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary dark:hover:bg-primary/90 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
  },
  
  // Input styles
  input: 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 focus:border-primary-500 dark:focus:border-primary focus:ring-primary-500 dark:focus:ring-primary',
  
  // Table styles
  table: {
    header: 'bg-gray-50 dark:bg-gray-800/50',
    headerText: 'text-gray-500 dark:text-gray-400',
    row: 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
    divider: 'divide-gray-200 dark:divide-border',
  },
  
  // Badge styles
  badge: {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
    success: 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400',
    warning: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400',
    error: 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400',
  },
  
  // Border styles
  border: 'border-gray-200 dark:border-border',
  
  // Background styles
  background: {
    primary: 'bg-gray-50 dark:bg-background',
    secondary: 'bg-white dark:bg-card',
  }
} as const

// Utility function to combine theme classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}