// Simple starter script to debug issues
import('./dist/http-server.js').then(() => {
  console.log('HTTP server module loaded successfully');
}).catch(err => {
  console.error('Failed to load HTTP server:', err);
  process.exit(1);
});