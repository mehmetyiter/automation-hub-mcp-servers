import chalk from 'chalk';

export function formatDate(date: string | Date | undefined): string {
  if (!date) return '-';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  
  // Format as YYYY-MM-DD HH:mm:ss
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function formatStatus(active: boolean): string;
export function formatStatus(finished: boolean, status?: string): string;
export function formatStatus(activeOrFinished: boolean, status?: string): string {
  if (status !== undefined) {
    // Execution status
    if (!activeOrFinished) {
      return chalk.blue('Running');
    }
    
    switch (status) {
      case 'success':
        return chalk.green('Success');
      case 'error':
        return chalk.red('Error');
      case 'warning':
        return chalk.yellow('Warning');
      default:
        return chalk.gray(status || 'Unknown');
    }
  } else {
    // Workflow status
    return activeOrFinished ? chalk.green('Active') : chalk.gray('Inactive');
  }
}

export function formatDuration(start: string | Date, end?: string | Date): string {
  if (!start) return '-';
  
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  
  if (isNaN(startTime) || isNaN(endTime)) return '-';
  
  const duration = endTime - startTime;
  
  // Format duration
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else if (duration < 3600000) {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}