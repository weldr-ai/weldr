import type { Declaration } from "@/ai/utils/declarations";
import type { declarations } from "@weldr/db/schema";
import type {
  ClassMemberInfo,
  DeclarationData,
  DeclarationSpecs,
} from "@weldr/shared/types/declarations";
import type { dbModelDeclarationSpecsSchema } from "@weldr/shared/validators/declarations/db-model";
import type { endpointDeclarationSpecsSchema } from "@weldr/shared/validators/declarations/endpoint";
import type { pageDeclarationSpecsSchema } from "@weldr/shared/validators/declarations/page";
import type { z } from "zod";

export function formatEndpointToMarkdown(
  endpoint: z.infer<typeof endpointDeclarationSpecsSchema>,
): string {
  let markdown = `\`\`\`http\n${endpoint.method.toUpperCase()} ${
    endpoint.path
  }\n\`\`\`\n\n`;
  markdown += `**Summary:** ${endpoint.summary}\n\n`;
  if (endpoint.description) {
    markdown += `**Description:** ${endpoint.description}\n\n`;
  }
  if (endpoint.protected) {
    markdown += "**Authentication:** Required\n\n";
  }

  if (endpoint.tags && endpoint.tags.length > 0) {
    markdown += `**Tags:** ${endpoint.tags.join(", ")}\n\n`;
  }

  if (endpoint.parameters && endpoint.parameters.length > 0) {
    markdown += "**Parameters:**\n";
    markdown += "| Name | In | Required | Description |\n";
    markdown += "|------|----|----------|-------------|\n";
    for (const param of endpoint.parameters) {
      markdown += `| \`${param.name}\` | ${param.in} | ${
        param.required ?? false
      } | ${param.description ?? ""} |\n`;
    }
    markdown += "\n";
  }

  if (endpoint.requestBody) {
    markdown += "**Request Body:**\n";
    for (const contentType in endpoint.requestBody.content) {
      markdown += `*   **${contentType}**\n`;
      const schema =
        endpoint.requestBody.content[
          contentType as keyof typeof endpoint.requestBody.content
        ]?.schema;
      if (schema) {
        markdown += `    \`\`\`json\n${JSON.stringify(
          schema,
          null,
          2,
        )}\n\`\`\`\n`;
      }
    }
    markdown += "\n";
  }

  markdown += "**Responses:**\n";
  for (const statusCode in endpoint.responses) {
    const response = endpoint.responses[statusCode];
    if (response) {
      markdown += `*   **${statusCode}**: ${response.description}\n`;
      if (response.content) {
        for (const contentType in response.content) {
          markdown += `    *   **${contentType}**\n`;
          const schema =
            response.content[contentType as keyof typeof response.content]
              ?.schema;
          if (schema) {
            markdown += `        \`\`\`json\n${JSON.stringify(
              schema,
              null,
              2,
            )}\n\`\`\`\n`;
          }
        }
      }
    }
  }
  markdown += "\n";
  return markdown;
}

export function formatDbModelToMarkdown(
  model: z.infer<typeof dbModelDeclarationSpecsSchema>,
): string {
  let markdown = `**Table Name:** \`${model.name}\`\n\n`;

  markdown += "**Columns:**\n";
  markdown += "| Name | Type | Nullable | Primary Key | Unique | Default |\n";
  markdown += "|------|------|----------|-------------|--------|---------|\n";
  for (const col of model.columns) {
    markdown += `| \`${col.name}\` | \`${col.type}\` | ${
      col.nullable ?? false
    } | ${col.isPrimaryKey ?? false} | ${col.unique ?? false} | ${
      col.default ?? ""
    } |\n`;
  }
  markdown += "\n";

  if (model.relationships && model.relationships.length > 0) {
    markdown += "**Relationships:**\n";
    for (const rel of model.relationships) {
      markdown += `- **${rel.type}** with \`${rel.referencedModel}\` on column \`${rel.referencedColumn}\`\n`;
    }
    markdown += "\n";
  }

  if (model.indexes && model.indexes.length > 0) {
    markdown += "**Indexes:**\n";
    for (const idx of model.indexes) {
      markdown += `- **${idx.name}**: on columns (${idx.columns.join(
        ", ",
      )}) ${idx.unique ? "(unique)" : ""}\n`;
    }
    markdown += "\n";
  }

  return markdown;
}

export function formatPageToMarkdown(
  page: z.infer<typeof pageDeclarationSpecsSchema>,
): string {
  let markdown = `**Route:** \`${page.route}\`\n\n`;
  markdown += `**Description:** ${page.description}\n\n`;
  if (page.protected) {
    markdown += "**Authentication:** Required\n\n";
  }
  if (page.meta) {
    markdown += `**Meta:** ${page.meta}\n\n`;
  }
  if (page.parameters) {
    markdown += "**Parameters:**\n";
    markdown += "| Name | In | Required | Description |\n";
    markdown += "|------|----|----------|-------------|\n";
    for (const param of page.parameters) {
      markdown += `| \`${param.name}\` | ${param.in} | ${
        param.required ?? false
      } | ${param.description ?? ""} |\n`;
    }
    markdown += "\n";
  }

  return markdown;
}

export function formatTaskDeclarationToMarkdown(
  declaration: Declaration,
): string {
  if (!declaration.specs) {
    return `### Declaration with invalid specs\n\nID: ${declaration.id}\n\n---\n\n`;
  }

  let markdown = formatDeclarationSpecs(declaration);

  if (declaration.dependencies && declaration.dependencies.length > 0) {
    markdown += "**Dependencies You Should Use:**\n";
    for (const dep of declaration.dependencies) {
      markdown += formatDeclarationSpecs(dep.dependency);
    }
    markdown += "\n";
  }

  if (declaration.integrations && declaration.integrations.length > 0) {
    markdown += "**Integrations and Services You Should Use:**\n";
    for (const int of declaration.integrations) {
      markdown += `- ${int.integration.integrationTemplate.name} - ${int.integration.integrationTemplate.type}\n`;
    }
    markdown += "\n";
  }

  if (
    declaration.implementationDetails?.acceptanceCriteria &&
    declaration.implementationDetails.acceptanceCriteria.length > 0
  ) {
    markdown += "**Acceptance Criteria You Should Follow:**\n";
    for (const criteria of declaration.implementationDetails
      .acceptanceCriteria) {
      markdown += `- ${criteria}\n`;
    }
    markdown += "\n";
  }

  if (
    declaration.implementationDetails?.implementationNotes &&
    declaration.implementationDetails.implementationNotes.length > 0
  ) {
    markdown += "**Implementation Notes You Should Follow:**\n";
    for (const note of declaration.implementationDetails.implementationNotes) {
      markdown += `- ${note}\n`;
    }
    markdown += "\n";
  }

  if (
    declaration.implementationDetails?.subTasks &&
    declaration.implementationDetails?.subTasks.length > 0
  ) {
    markdown += "**Sub-Tasks That Can Help You Implement the Declaration:**\n";
    for (const subTask of declaration.implementationDetails.subTasks) {
      markdown += `- ${subTask}\n`;
    }
  }

  markdown += "\n---\n\n";

  return markdown;
}

export function formatDeclarationSpecs(
  declaration: typeof declarations.$inferSelect,
): string {
  const specs = declaration.specs as DeclarationSpecs | null;
  const data = declaration.data;

  if (
    !specs ||
    !(
      specs.data.type === "endpoint" ||
      specs.data.type === "db-model" ||
      specs.data.type === "page"
    )
  ) {
    return "";
  }

  // Extract position information from data (not specs)
  const position = data?.position;

  const name =
    specs.data.type === "endpoint"
      ? `${specs.data.method} ${specs.data.path}`
      : specs.data.name;
  const category =
    specs.data.type === "db-model" ? "db_model" : specs.data.type;

  let result = `## ${category}: ${name}\n\n`;

  result += `**ID:** \`${declaration.id}\`\n\n`;

  if (declaration.path) {
    result += `**Path:** \`${declaration.path}\``;
    if (position) {
      result += ` (Start line ${position.start.line - 5}, End line ${position.end.line + 5})`;
    }
    result += "\n\n";
  }

  // Use the existing formatters for the specific content
  switch (specs.data.type) {
    case "endpoint":
      result += formatEndpointToMarkdown(specs.data);
      break;
    case "db-model":
      result += formatDbModelToMarkdown(specs.data);
      break;
    case "page":
      result += formatPageToMarkdown(specs.data);
      break;
  }

  return result;
}

// Helper function to format common declaration info
function formatDeclarationHeader(
  declaration: typeof declarations.$inferSelect,
  data: DeclarationData,
): string {
  const name = data.name || "Unknown";
  const category = data.semanticInfo?.category || data.type;
  const position = data.position;

  // Include category if it's not unknown
  let result = "";
  if (category && category !== "unknown") {
    result = `## ${category}: ${name}\n`;
  } else {
    result = `## ${name}\n`;
  }

  // Add ID for fetching related declarations
  result += `**ID:** \`${declaration.id}\`\n\n`;

  // Add position with tolerance for reading file parts
  if (declaration.path && position) {
    const startLine = Math.max(1, position.start.line - 5);
    const endLine = position.end.line + 5;
    result += `*${declaration.path}:${startLine}-${endLine}*\n\n`;
  }

  // Add purpose - most critical for LLMs
  if (data.semanticInfo?.purpose) {
    result += `${data.semanticInfo.purpose}\n\n`;
  }

  // Add type signature if available - essential for understanding
  if (data.typeSignature) {
    result += `\`\`\`typescript\n${data.typeSignature}\n\`\`\`\n\n`;
  }

  return result;
}

function formatFunctionDeclaration(data: DeclarationData): string {
  let result = "";

  // Function modifiers (only if present)
  const modifiers = [];
  if (data.isAsync) modifiers.push("async");
  if (data.isGenerator) modifiers.push("generator");
  if (modifiers.length > 0) {
    result += `*${modifiers.join(", ")} function*\n\n`;
  }

  // Parameters - critical for usage
  if (data.parameters && data.parameters.length > 0) {
    result += "**Parameters:**\n";
    for (const param of data.parameters) {
      const optional = param.isOptional ? "?" : "";
      const rest = param.isRest ? "..." : "";
      result += `- ${rest}${param.name}${optional}: \`${param.type}\`\n`;
    }
    result += "\n";
  }

  // Return type - essential
  if (data.returnType) {
    result += `**Returns:** \`${data.returnType}\`\n\n`;
  }

  return result;
}

function formatClassDeclaration(data: DeclarationData): string {
  let result = "";

  // Inheritance info - important for understanding structure
  if (data.extends) {
    result += `**Extends:** \`${data.extends}\`\n`;
  }
  if (data.implements && data.implements.length > 0) {
    result += `**Implements:** ${data.implements.map((impl) => `\`${impl}\``).join(", ")}\n`;
  }
  if (data.extends || (data.implements && data.implements.length > 0)) {
    result += "\n";
  }

  // Class members - essential structure info
  if (
    data.members &&
    typeof data.members === "object" &&
    "properties" in data.members
  ) {
    const members = data.members as ClassMemberInfo;

    if (members.properties && members.properties.length > 0) {
      result += "**Properties:**\n";
      for (const prop of members.properties) {
        const modifiers = [];
        if (prop.isStatic) modifiers.push("static");
        if (prop.isPrivate) modifiers.push("private");
        if (prop.isProtected) modifiers.push("protected");
        if (prop.isReadonly) modifiers.push("readonly");
        const modifierText =
          modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
        const optional = prop.isOptional ? "?" : "";
        result += `- ${modifierText}${prop.name}${optional}: \`${prop.type}\`\n`;
      }
      result += "\n";
    }

    if (members.methods && members.methods.length > 0) {
      result += "**Methods:**\n";
      for (const method of members.methods) {
        const modifiers = [];
        if (method.isStatic) modifiers.push("static");
        if (method.isPrivate) modifiers.push("private");
        if (method.isProtected) modifiers.push("protected");
        if (method.isAsync) modifiers.push("async");
        const modifierText =
          modifiers.length > 0 ? `${modifiers.join(" ")} ` : "";
        const params = method.parameters
          .map((p) => `${p.name}: ${p.type}`)
          .join(", ");
        result += `- ${modifierText}${method.name}(${params}): \`${method.returnType}\`\n`;
      }
      result += "\n";
    }

    if (members.constructor) {
      const params = members.constructor.parameters
        .map((p) => `${p.name}: ${p.type}`)
        .join(", ");
      result += `**Constructor:** (${params})\n\n`;
    }
  }

  return result;
}

function formatEnumDeclaration(data: DeclarationData): string {
  let result = "";

  if (data.enumMembers && data.enumMembers.length > 0) {
    for (const member of data.enumMembers) {
      const initializer = member.initializer ? ` = ${member.initializer}` : "";
      result += `- ${member.name}${initializer}\n`;
    }
    result += "\n";
  }

  return result;
}

function formatNamespaceDeclaration(
  data: DeclarationData,
  memberDeclarations?: (typeof declarations.$inferSelect)[],
): string {
  let result = "";

  // If we have actual member declarations from the database, format them concisely
  if (memberDeclarations && memberDeclarations.length > 0) {
    result += "**Members:**\n";
    for (const memberDeclaration of memberDeclarations) {
      const memberData = memberDeclaration.data as DeclarationData | null;
      if (memberData) {
        const purpose = memberData.semanticInfo?.purpose || "";
        result += `- **${memberData.name}** (${memberData.type})`;
        if (purpose) result += ` - ${purpose}`;
        result += "\n";
      }
    }
    result += "\n";
  }
  // Fallback: simple list
  else if (data.members && Array.isArray(data.members)) {
    result += "**Members:**\n";
    for (const member of data.members as DeclarationData[]) {
      const purpose = member.semanticInfo?.purpose || "";
      result += `- **${member.name}** (${member.type})`;
      if (purpose) result += ` - ${purpose}`;
      result += "\n";
    }
    result += "\n";
  }

  return result;
}

function formatInterfaceOrTypeDeclaration(data: DeclarationData): string {
  let result = "";

  // For interfaces, show extends information
  if (data.type === "interface" && data.extends) {
    result += `**Extends:** \`${data.extends}\`\n\n`;
  }

  // Show members concisely
  if (data.members && Array.isArray(data.members)) {
    result += "**Members:**\n";
    for (const member of data.members as DeclarationData[]) {
      const memberType = member.typeSignature || member.type || "unknown";
      result += `- ${member.name}: \`${memberType}\`\n`;
    }
    result += "\n";
  }

  return result;
}

function formatVariableDeclaration(data: DeclarationData): string {
  let result = "";

  // Just show mutability if it's not const (since const is most common)
  if (data.type !== "const") {
    result += `*${data.type} variable*\n\n`;
  }

  return result;
}

function formatUsageInfo(data: DeclarationData): string {
  let result = "";

  if (data.semanticInfo?.usagePattern) {
    const usage = data.semanticInfo.usagePattern;

    // Only show the most practical examples (limit to 1-2)
    if (usage.examples && usage.examples.length > 0) {
      const example = usage.examples[0];
      if (example) {
        result += "**Example:**\n";
        result += `\`\`\`typescript\n${example.code}\n\`\`\`\n\n`;
      }
    }

    // Show only critical limitations
    if (usage.limitations && usage.limitations.length > 0) {
      result += `**Note:** ${usage.limitations[0]}\n\n`;
    }
  }

  // Show only critical dependencies (external packages)
  if (data.dependencies && data.dependencies.length > 0) {
    const externalDeps = data.dependencies.filter(
      (dep) => dep.type === "external",
    );
    if (externalDeps.length > 0) {
      result += "**Requires:** ";
      result += externalDeps.map((dep) => `\`${dep.packageName}\``).join(", ");
      result += "\n\n";
    }
  }

  return result;
}

export function formatDeclarationData(
  declaration: typeof declarations.$inferSelect,
): string {
  const data = declaration.data as DeclarationData | null;

  if (!data) {
    return "";
  }

  let result = formatDeclarationHeader(declaration, data);

  // Dispatch based on declaration type
  switch (data.type) {
    case "function":
      result += formatFunctionDeclaration(data);
      break;
    case "class":
      result += formatClassDeclaration(data);
      break;
    case "enum":
      result += formatEnumDeclaration(data);
      break;
    case "namespace":
      result += formatNamespaceDeclaration(data);
      break;
    case "interface":
    case "type":
      result += formatInterfaceOrTypeDeclaration(data);
      break;
    case "const":
    case "let":
    case "var":
      result += formatVariableDeclaration(data);
      break;
    default:
      break;
  }

  result += formatUsageInfo(data);

  return result.trim();
}
