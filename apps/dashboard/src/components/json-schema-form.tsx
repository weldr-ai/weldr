import type { JsonSchema } from "@integramind/shared/types";
import { Alert, AlertDescription } from "@integramind/ui/alert";
import { Button } from "@integramind/ui/button";
import { Card, CardContent } from "@integramind/ui/card";
import { Input } from "@integramind/ui/input";
import { Label } from "@integramind/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Switch } from "@integramind/ui/switch";
import { Textarea } from "@integramind/ui/textarea";
import { createId } from "@paralleldrive/cuid2";
import { Minus, Plus } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface ValidationError {
  path: string;
  message: string;
}

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
    // Initialize with all field paths
    const paths = new Set<string>();
    const collectPaths = (schema: JsonSchema, parentPath = "") => {
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const currentPath = parentPath ? `${parentPath}.${key}` : key;
          paths.add(currentPath);
          collectPaths(prop, currentPath);
        }
      }
    };
    collectPaths(schema);
    return paths;
  });

  // Validation logic remains the same
  const validateField = (
    value: unknown,
    schema: JsonSchema,
    path: string,
  ): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (
      schema.required &&
      !disabledFields.has(path) &&
      (value === undefined || value === "")
    ) {
      errors.push({ path, message: "This field is required" });
      return errors;
    }

    switch (schema.type) {
      case "string":
        if (schema.minLength && (value as string).length < schema.minLength) {
          errors.push({
            path,
            message: `Minimum length is ${schema.minLength}`,
          });
        }
        if (schema.maxLength && (value as string).length > schema.maxLength) {
          errors.push({
            path,
            message: `Maximum length is ${schema.maxLength}`,
          });
        }
        break;

      case "number":
        if (schema.minimum && (value as number) < schema.minimum) {
          errors.push({
            path,
            message: `Minimum value is ${schema.minimum}`,
          });
        }
        if (schema.maximum && (value as number) > schema.maximum) {
          errors.push({
            path,
            message: `Maximum value is ${schema.maximum}`,
          });
        }
        break;
    }

    return errors;
  };

  const handleChange = (path: string, value: unknown, schema: JsonSchema) => {
    setFormData((prevData: unknown) => {
      const newData = { ...(prevData ?? {}) };
      const parts = path.split(".");
      const last = parts[parts.length - 1];
      if (!last) return prevData;

      // If the field is disabled, don't update the value
      if (disabledFields.has(path)) {
        return prevData;
      }

      // Navigate to the correct nested object
      let current = newData;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part) continue;
        if (!(part in current)) {
          // @ts-expect-error
          current[part] = {};
        }
        // @ts-expect-error
        current = current[part] as Record<string, unknown>;
      }

      // Set the value
      // @ts-expect-error
      current[last] = value;
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
        next.add(path);
        setFormData((prevData: unknown) => {
          const newData = { ...(prevData ?? {}) };
          const parts = path.split(".");
          const last = parts[parts.length - 1];
          let current = newData;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!part) continue;
            if (!(part in current)) break;
            // @ts-expect-error
            current = current[part] as Record<string, unknown>;
          }
          // @ts-expect-error
          delete current[last];
          return newData;
        });
      }
      return next;
    });
  };

  const renderField = (
    name: string,
    schema: JsonSchema,
    path: string = name,
  ) => {
    const value =
      // @ts-expect-error
      path.split(".").reduce((obj, key) => obj?.[key], formData) ?? "";
    const isDisabled = disabledFields.has(path);

    switch (schema.type) {
      case "string":
        if (schema.enum) {
          return (
            <Select
              value={value as string}
              onValueChange={(value: string) =>
                handleChange(path, value, schema)
              }
              disabled={isDisabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${schema.title || name}`} />
              </SelectTrigger>
              <SelectContent>
                {schema.enum.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }

        if (schema.format === "textarea") {
          return (
            <Textarea
              value={value as string}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                handleChange(path, e.target.value, schema)
              }
              className="min-h-[100px]"
              disabled={isDisabled}
            />
          );
        }

        return (
          <Input
            type="text"
            value={value as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange(path, e.target.value, schema)
            }
            disabled={isDisabled}
          />
        );

      case "number":
      case "integer":
        return (
          <Input
            type="number"
            value={value as string}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleChange(path, Number(e.target.value), schema)
            }
            min={schema.minimum}
            max={schema.maximum}
            step={schema.type === "integer" ? 1 : "any"}
            disabled={isDisabled}
          />
        );

      case "boolean":
        return (
          <Switch
            checked={value as boolean}
            onCheckedChange={(checked: boolean) =>
              handleChange(path, checked, schema)
            }
            disabled={isDisabled}
          />
        );

      case "object":
        if (!schema.properties) return null;
        return (
          <Card className="mt-2">
            <CardContent className="pt-6 space-y-4">
              {Object.entries(schema.properties).map(([key, prop]) => (
                <div key={key}>
                  {renderFieldWrapper(key, prop, `${path}.${key}`)}
                </div>
              ))}
            </CardContent>
          </Card>
        );

      case "array": {
        if (!schema.items) return null;
        const arrayValue = value || [];
        return (
          <div className="space-y-2">
            {/* @ts-expect-error */}
            {arrayValue.map((_: unknown, index: number) => (
              <div key={createId()} className="flex items-center space-x-2">
                {renderField(
                  `${name}[${index}]`,
                  schema.items as JsonSchema,
                  `${path}.${index}`,
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // @ts-expect-error
                    const newValue = [...arrayValue];
                    newValue.splice(index, 1);
                    handleChange(path, newValue, schema);
                  }}
                  disabled={isDisabled}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // @ts-expect-error
                const newValue = [...arrayValue, ""];
                handleChange(path, newValue, schema);
              }}
              className="mt-2"
              disabled={isDisabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const renderFieldWrapper = (
    name: string,
    schema: JsonSchema,
    path: string = name,
  ) => {
    const fieldErrors = errors.filter((e) => e.path === path);
    const isDisabled = disabledFields.has(path);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>
              {schema.title || name}
              {schema.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {schema.description && (
              <p className="text-sm text-muted-foreground">
                {schema.description}
              </p>
            )}
          </div>
          {!schema.required && (
            <Switch
              checked={!isDisabled}
              onCheckedChange={() => toggleField(path)}
              aria-label={`Toggle ${schema.title || name}`}
            />
          )}
        </div>
        {renderField(name, schema, path)}
        {fieldErrors.map((error, index) => (
          <Alert variant="destructive" key={createId()}>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const allErrors: ValidationError[] = [];
    const validateRecursive = (
      data: unknown,
      schema: JsonSchema,
      path: string,
    ) => {
      if (schema.type === "object" && schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          validateRecursive(
            (data as Record<string, unknown>)?.[key],
            prop,
            path ? `${path}.${key}` : key,
          );
        }
      } else {
        const fieldErrors = validateField(data, schema, path);
        allErrors.push(...fieldErrors);
      }
    };

    validateRecursive(formData, schema as JsonSchema, "");
    setErrors(allErrors);

    if (allErrors.length === 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="space-y-2 px-6 py-4">
        {schema.properties &&
          Object.entries(schema.properties).map(([name, property]) => (
            <div key={name}>{renderFieldWrapper(name, property)}</div>
          ))}
      </Card>
      <div className="flex justify-end">
        <Button type="submit">Submit</Button>
      </div>
    </form>
  );
}
