export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="text-gray-400 dark:text-gray-600" size={28} />
      </div>
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-500 dark:text-gray-500 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}
