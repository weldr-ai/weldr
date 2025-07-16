// Component to render styled commit type badge
export function CommitTypeBadge({
  type,
  className,
}: {
  type: string | null;
  className?: string;
}) {
  if (!type) return null;

  const getTypeStyles = (type: string) => {
    switch (type.toLowerCase()) {
      case "feat":
      case "feature":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400";
      case "fix":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "docs":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "style":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "refactor":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400";
      case "test":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "chore":
        return "bg-accent text-accent-foreground";
      case "perf":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      case "ci":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400";
      case "build":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400";
      case "revert":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case "feat":
        return "Feature";
      case "fix":
        return "Fix";
      case "docs":
        return "Docs";
      case "style":
        return "Style";
      case "refactor":
        return "Refactor";
      case "test":
        return "Test";
      case "chore":
        return "Chore";
      case "perf":
        return "Perf";
      case "ci":
        return "CI";
      case "build":
        return "Build";
      case "revert":
        return "Revert";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 font-medium text-xs ${getTypeStyles(type)} ${className}`}
    >
      {getTypeLabel(type)}
    </span>
  );
}
