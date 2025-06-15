import type { JsonSchema } from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import { Card } from "@weldr/ui/components/card";
import { useState } from "react";
import { FieldWrapper } from "./field-wrapper";
import type { RecordValue, ValidationError } from "./types";
import { hasProperties, isJsonSchema } from "./utils";

interface JsonSchemaFormProps {
  schema: JsonSchema;
  onSubmit: (data: unknown) => void;
  formData?: unknown;
  setFormData: (data: unknown) => void;
}

export function JsonSchemaForm({
  schema,
  onSubmit,
  formData = {},
  setFormData,
}: JsonSchemaFormProps) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [disabledFields, setDisabledFields] = useState<Set<string>>(() => {
    // Initialize with all field paths that don't have values and are not required
    const paths = new Set<string>();
    const collectPaths = (
      schema: JsonSchema,
      parentPath = "",
      data: unknown = formData,
    ) => {
      if (hasProperties(schema)) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          if (!isJsonSchema(prop)) continue;
          const currentPath = parentPath ? `${parentPath}.${key}` : key;
          // Only add to disabled fields if the field has no value and is not required
          const value = currentPath
            .split(".")
            .reduce((obj, key) => (obj as RecordValue)?.[key], data);
          const isRequired = schema.required?.includes(key);
          // Never disable required fields
          if (!isRequired && value === undefined) {
            paths.add(currentPath);
          }
          // Continue collecting paths for nested objects
          if (prop.type === "object") {
            collectPaths(prop, currentPath, (data as RecordValue)?.[key]);
          }
        }
      }
    };
    collectPaths(schema);
    return paths;
  });

  const handleChange = (path: string, value: unknown, schema: JsonSchema) => {
    setFormData((prevData: unknown) => {
      const newData = { ...(prevData ?? {}) };
      const parts = path.split(".");
      const last = parts[parts.length - 1];
      let current = newData as RecordValue;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part] as RecordValue;
      }

      if (last) {
        current[last] = value;
      }

      return newData;
    });

    const fieldErrors = validateField(value, schema, path);
    setErrors((prevErrors) => [
      ...prevErrors.filter((e) => e.path !== path),
      ...fieldErrors,
    ]);
  };

  const toggleField = (path: string) => {
    setDisabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        // Get the field's schema to check if it's required
        const pathParts = path.split(".");
        let currentSchema = schema;
        let isRequired = false;

        // Navigate through the schema to find the field
        for (const part of pathParts) {
          if (
            currentSchema.type === "object" &&
            currentSchema.properties &&
            part in currentSchema.properties
          ) {
            const property = currentSchema.properties[part];
            // Check if property exists and is a valid schema
            if (property !== undefined && isJsonSchema(property)) {
              isRequired = currentSchema.required?.includes(part) ?? false;
              currentSchema = property;
            }
          }
        }

        // Only add to disabled fields if not required
        if (!isRequired) {
          next.add(path);
          setFormData((prevData: unknown) => {
            const newData = { ...(prevData ?? {}) };
            const parts = path.split(".");
            const last = parts[parts.length - 1];
            let current = newData as RecordValue;
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              if (!part) continue;
              if (!(part in current)) break;
              current = current[part] as RecordValue;
            }
            if (last) {
              delete current[last];
            }
            return newData;
          });
        }
      }
      return next;
    });
  };

  const validateField = (
    value: unknown,
    schema: JsonSchema,
    path: string,
  ): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (
      Array.isArray(schema.required) &&
      schema.required.includes(path) &&
      !disabledFields.has(path) &&
      (value === undefined || value === "" || value === false)
    ) {
      errors.push({ path, message: "This field is required" });
      return errors;
    }

    if (schema.type) {
      switch (schema.type) {
        case "string":
          if (
            typeof value === "string" &&
            schema.minLength &&
            value.length < schema.minLength
          ) {
            errors.push({
              path,
              message: `Minimum length is ${schema.minLength}`,
            });
          }
          if (
            typeof value === "string" &&
            schema.maxLength &&
            value.length > schema.maxLength
          ) {
            errors.push({
              path,
              message: `Maximum length is ${schema.maxLength}`,
            });
          }
          break;

        case "number":
        case "integer":
          if (
            typeof value === "number" &&
            schema.minimum &&
            value < schema.minimum
          ) {
            errors.push({
              path,
              message: `Minimum value is ${schema.minimum}`,
            });
          }
          if (
            typeof value === "number" &&
            schema.maximum &&
            value > schema.maximum
          ) {
            errors.push({
              path,
              message: `Maximum value is ${schema.maximum}`,
            });
          }
          break;
      }
    }

    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const allErrors: ValidationError[] = [];
    const validateRecursive = (
      data: unknown,
      schemaDef: JsonSchema,
      path: string,
    ) => {
      if (schemaDef.type === "object" && schemaDef.properties) {
        for (const [key, prop] of Object.entries(schemaDef.properties)) {
          if (isJsonSchema(prop)) {
            validateRecursive(
              (data as Record<string, unknown>)?.[key],
              prop,
              path ? `${path}.${key}` : key,
            );
          }
        }
      } else {
        const fieldErrors = validateField(data, schemaDef, path);
        allErrors.push(...fieldErrors);
      }
    };

    validateRecursive(formData, schema, "");
    setErrors(allErrors);

    if (allErrors.length === 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="space-y-2 px-6 py-4">
        {schema.properties &&
          Object.entries(schema.properties).map(([name, property]) => {
            if (!isJsonSchema(property)) return null;
            const isRequired = schema.required?.includes(name) ?? false;
            const value = (formData as RecordValue)?.[name];
            const fieldErrors = errors.filter((e) => e.path === name);
            const isDisabled = disabledFields.has(name);

            return (
              <div key={name}>
                <FieldWrapper
                  name={name}
                  schema={property}
                  path={name}
                  isRequired={isRequired}
                  isDisabled={isDisabled}
                  value={value}
                  errors={fieldErrors}
                  onToggle={toggleField}
                  onChange={handleChange}
                />
              </div>
            );
          })}
      </Card>
      <div className="flex justify-end">
        <Button type="submit">Submit</Button>
      </div>
    </form>
  );
}
