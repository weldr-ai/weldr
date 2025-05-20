export async function getPackageVersion(
  packageName: string,
): Promise<string | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const installedVersion = data["dist-tags"].latest;
    return installedVersion;
  } catch (error) {
    console.error(`Error fetching version for ${packageName}:`, error);
    return null;
  }
}

export const getBasePackageJson = (name: string) => ({
  name,
  private: true,
  scripts: {
    dev: "vinxi dev",
    start: "vinxi start",
    build: "vinxi build",
    "check-types": "tsc --noEmit",
    check: "biome check",
    "check:fix": "biome check . --write",
    format: "biome format",
    lint: "biome lint",
    "db:check": "drizzle-kit check",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:pull": "drizzle-kit pull",
  },
});
