export function shortenFileName(fileName: string, maxLength = 20): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const ellipsis = "...";
  const availableCharacters = maxLength - ellipsis.length;

  if (availableCharacters <= 0) {
    return fileName.substring(0, maxLength);
  }

  const start = fileName.substring(0, 9);
  const end = fileName.substring(fileName.length - 8);

  return start + ellipsis + end;
}

export function parseConventionalCommit(message: string | null) {
  if (!message) return { type: null, message: null };

  const match = message.match(/^(\w+)(?:\([^)]+\))?\s*:\s*(.+)$/);
  if (match) {
    return {
      type: match[1],
      message: match[2],
    };
  }
  return {
    type: null,
    message: message,
  };
}
