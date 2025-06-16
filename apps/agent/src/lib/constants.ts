import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

export const WORKSPACE_DIR = isDev
  ? path.resolve(__dirname, "../../.temp")
  : "/workspace";

export const BOILERPLATES_DIR = isDev
  ? path.resolve(__dirname, "../../data/boilerplates")
  : "/.weldr/data/boilerplates";

export const SCRIPTS_DIR = isDev
  ? path.resolve(__dirname, "../../scripts")
  : "/.weldr/scripts";
