const variants = {
  // Status
  open:        'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  waiting:     'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  resolved:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  closed:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  // Priority
  low:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  high:   'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  // Plan
  free:       'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  starter:    'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  pro:        'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  enterprise: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  // Role
  owner:  'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
  admin:  'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  agent:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  // Custom
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  danger:  'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  info:    'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  // Published
  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function Badge({ label, variant = 'info', dot = false, className = '' }) {
  const style = variants[variant] || variants.info;
  return (
    <span className={`badge ${style} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full bg-current`} />}
      {label}
    </span>
  );
}
