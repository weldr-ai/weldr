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
    build: "next build",
    check: "next lint && tsc --noEmit",
    dev: "next dev --turbo",
    lint: "next lint",
    "lint:fix": "next lint --fix",
    preview: "next build && next start",
    start: "next start",
    typecheck: "tsc --noEmit",
    "format:write": 'prettier --write "**/*.{ts,tsx,js,jsx,mdx}" --cache',
    "format:check": 'prettier --check "**/*.{ts,tsx,js,jsx,mdx}" --cache',
  },
});
