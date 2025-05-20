import type { ProjectConfig } from "@weldr/shared/types";
import Handlebars from "handlebars";
import * as fs from "node:fs";
import * as path from "node:path";

// Register Handlebars helpers
Handlebars.registerHelper("or", (...args) => {
  const params = args.slice(0, -1);
  return params.some(Boolean);
});

Handlebars.registerHelper("and", (...args) => {
  const params = args.slice(0, -1);
  return params.every(Boolean);
});

Handlebars.registerHelper("not", (value) => {
  return !value;
});

type GeneratedFile = {
  path: string;
  content: string;
};

function processTemplateFile(
  templatePath: string,
  relativePath: string,
  config: ProjectConfig,
  fileConditions: { [filename: string]: (cfg: ProjectConfig) => boolean },
): GeneratedFile | null {
  const condition = fileConditions[relativePath];
  if (condition && !condition(config)) {
    return null;
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const template = Handlebars.compile(templateContent);
  const output = template(config);

  if (!output.trim()) {
    return null;
  }

  return {
    path: relativePath,
    content: output,
  };
}

function processDirectory(
  dirPath: string,
  baseDir: string,
  config: ProjectConfig,
  fileConditions: { [filename: string]: (cfg: ProjectConfig) => boolean },
): GeneratedFile[] {
  const results: GeneratedFile[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      results.push(
        ...processDirectory(fullPath, baseDir, config, fileConditions),
      );
    } else if (entry.isFile() && entry.name.endsWith(".hbs")) {
      const result = processTemplateFile(
        fullPath,
        relativePath,
        config,
        fileConditions,
      );
      if (result) {
        results.push(result);
      }
    }
  }

  return results;
}

function writeFilesToTempDir(generatedFiles: GeneratedFile[]) {
  const tempDir = path.join(__dirname, ".output");

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const file of generatedFiles) {
    const outputPath = path.join(tempDir, file.path.replace(/\.hbs$/, ""));

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, file.content);
  }
}

export function generate(config: ProjectConfig): GeneratedFile[] {
  const fileConditions: {
    [filename: string]: (cfg: ProjectConfig) => boolean;
  } = {
    "src/server/db/index.ts.hbs": (cfg) => cfg.database || cfg.auth,
    "drizzle.config.ts.hbs": (cfg) => cfg.database || cfg.auth,
    "src/server/trpc/init.ts.hbs": (cfg) => cfg.web,
    "src/web/routes/__root.tsx.hbs": (cfg) => cfg.web,
  };

  const templatesDir = path.join(__dirname, "templates");
  const results = processDirectory(
    templatesDir,
    templatesDir,
    config,
    fileConditions,
  );

  return results;
}

const files = generate({
  server: true,
  web: true,
  database: true,
  auth: true,
  env: {
    DATABASE_URL: "DATABASE_URL",
  },
});

writeFilesToTempDir(files);
