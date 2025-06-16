import { readFileSync, writeFileSync } from "node:fs";

// Parse command line arguments
const args = process.argv.slice(2);
const isWebMode = args.includes("--web");

const appPackagePath = `${
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../.temp")
    : "/workspace"
}/package.json`;
const boilerplatePackagePath = `${
  isDev
    ? path.resolve(__dirname, "../data/boilerplates")
    : "/.weldr/data/boilerplates"
}/${isWebMode ? "add-web" : "add-server"}/package.json`;

try {
  // Read both package.json files
  const appPackage = JSON.parse(readFileSync(appPackagePath, "utf8"));
  const boilerplatePackage = JSON.parse(
    readFileSync(boilerplatePackagePath, "utf8"),
  );

  // Update scripts only for web mode
  if (isWebMode) {
    const scriptsToUpdate = ["dev", "start", "build"];

    for (const script of scriptsToUpdate) {
      if (boilerplatePackage.scripts?.[script]) {
        appPackage.scripts[script] = boilerplatePackage.scripts[script];
      }
    }

    const depsToRemove = ["esbuild", "tsx"];
    if (appPackage.devDependencies) {
      for (const dep of depsToRemove) {
        delete appPackage.devDependencies[dep];
      }
    }
  }

  // Merge dependencies
  if (boilerplatePackage.dependencies) {
    if (!appPackage.dependencies) {
      appPackage.dependencies = {};
    }
    for (const dep of Object.keys(boilerplatePackage.dependencies)) {
      if (!appPackage.dependencies[dep]) {
        appPackage.dependencies[dep] = boilerplatePackage.dependencies[dep];
      }
    }
  }

  // Merge devDependencies
  if (boilerplatePackage.devDependencies) {
    if (!appPackage.devDependencies) {
      appPackage.devDependencies = {};
    }
    for (const dep of Object.keys(boilerplatePackage.devDependencies)) {
      if (!appPackage.devDependencies[dep]) {
        appPackage.devDependencies[dep] =
          boilerplatePackage.devDependencies[dep];
      }
    }
  }

  // Write updated package.json
  writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2));
} catch (error) {
  console.error("Error updating package.json:", error.message);
  process.exit(1);
}
