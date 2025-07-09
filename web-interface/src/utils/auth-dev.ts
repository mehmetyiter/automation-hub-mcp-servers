// Development authentication utilities
// This provides a working auth system for development without requiring actual login

export const DEV_USER = {
  id: 1,
  userId: 1,
  email: 'dev@example.com',
  name: 'Dev User',
  role: 'admin'
};

export const DEV_TOKEN = 'dev-token-12345';

export function setupDevAuth() {
  // Set up development authentication
  localStorage.setItem('auth_token', DEV_TOKEN);
  localStorage.setItem('user', JSON.stringify(DEV_USER));
  
  console.log('🔧 Development authentication enabled');
  console.log('User:', DEV_USER);
  console.log('Token:', DEV_TOKEN);
}

export function isDevMode() {
  // Check if we're in development mode
  return import.meta.env.MODE === 'development' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}