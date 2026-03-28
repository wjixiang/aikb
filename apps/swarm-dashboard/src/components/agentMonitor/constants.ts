export const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  running:
    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  completed:
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  aborted: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  stopped: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export const ROLE_COLORS: Record<string, string> = {
  user: 'text-blue-600 dark:text-blue-400',
  assistant: 'text-green-600 dark:text-green-400',
  system: 'text-muted-foreground',
};

export const ROLE_BG: Record<string, string> = {
  user: 'bg-blue-50 dark:bg-blue-950/30',
  assistant: 'bg-green-50 dark:bg-green-950/30',
  system: 'bg-muted/50',
};
