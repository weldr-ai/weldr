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
