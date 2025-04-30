import { Button } from "@weldr/ui/components/button";
import { Card, CardContent } from "@weldr/ui/components/card";
import { Input } from "@weldr/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@weldr/ui/components/select";
import { Switch } from "@weldr/ui/components/switch";
import { Textarea } from "@weldr/ui/components/textarea";
import type { JSONSchema7Type } from "json-schema";
import { Minus, Plus } from "lucide-react";
import type { FormFieldProps } from "./types";

export function FormField({
  name,
  schema,
  path,
  value,
  isDisabled,
  onChange,
}: FormFieldProps) {
  if (!schema.type) return null;

  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return (
          <Select
            value={value as string}
            onValueChange={(value) => onChange(path, value, schema)}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${schema.title || name}`} />
            </SelectTrigger>
            <SelectContent>
              {schema.enum.map((option: JSONSchema7Type) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {String(option)}
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
            onChange={(e) => onChange(path, e.target.value, schema)}
            className="min-h-[100px]"
            disabled={isDisabled}
          />
        );
      }

      return (
        <Input
          type="text"
          value={value as string}
          onChange={(e) => onChange(path, e.target.value, schema)}
          disabled={isDisabled}
        />
      );

    case "number":
    case "integer":
      return (
        <Input
          type="number"
          value={value as string}
          onChange={(e) => onChange(path, Number(e.target.value), schema)}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.type === "integer" ? 1 : "any"}
          disabled={isDisabled}
        />
      );

    case "boolean":
      return (
        <Switch
          checked={(value as boolean) ?? false}
          onCheckedChange={(checked) => onChange(path, checked, schema)}
          disabled={isDisabled}
        />
      );

    case "object":
      if (!schema.properties) return null;
      return (
        <Card className="mt-2">
          <CardContent className="space-y-4 pt-6">
            {Object.entries(schema.properties).map(([key, prop]) => {
              if (typeof prop === "boolean") return null;
              const fieldPath = `${path}.${key}`;
              const fieldValue = (value as Record<string, unknown>)?.[key];

              return (
                <FormField
                  key={key}
                  name={key}
                  schema={prop}
                  path={fieldPath}
                  value={fieldValue}
                  isDisabled={isDisabled}
                  onChange={onChange}
                />
              );
            })}
          </CardContent>
        </Card>
      );

    case "array": {
      if (!schema.items) return null;
      const arrayValue = (value || []) as unknown[];
      const items = schema.items;

      if (!Array.isArray(items) && typeof items !== "boolean") {
        return (
          <div className="space-y-2">
            {arrayValue.map((itemValue, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <div key={index} className="flex items-center space-x-2">
                <FormField
                  name={`${name}[${index}]`}
                  schema={items}
                  path={`${path}.${index}`}
                  value={itemValue}
                  isDisabled={isDisabled}
                  onChange={onChange}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newValue = [...arrayValue];
                    newValue.splice(index, 1);
                    onChange(path, newValue, schema);
                  }}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                let newItem: unknown;
                switch (items.type) {
                  case "object":
                    newItem = {};
                    break;
                  case "array":
                    newItem = [];
                    break;
                  case "number":
                  case "integer":
                    newItem = 0;
                    break;
                  case "boolean":
                    newItem = false;
                    break;
                  default:
                    newItem = "";
                }
                onChange(path, [...arrayValue, newItem], schema);
              }}
              className="mt-2"
              disabled={isDisabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        );
      }

      return null;
    }

    default:
      return null;
  }
}
