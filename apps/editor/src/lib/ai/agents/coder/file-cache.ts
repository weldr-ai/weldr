import { S3 } from "@weldr/shared/s3";

export class FileCache {
  private cache: Map<string, string> = new Map();

  async getFile({
    projectId,
    path,
  }: { projectId: string; path: string }): Promise<string | undefined> {
    const key = `${projectId}:${path}`;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const content = await S3.readFile({
      projectId,
      path,
    });

    if (content) {
      this.cache.set(key, content);
    }

    return content;
  }

  setFile({
    projectId,
    path,
    content,
  }: { projectId: string; path: string; content: string }): void {
    const key = `${projectId}:${path}`;
    this.cache.set(key, content);
  }
}
