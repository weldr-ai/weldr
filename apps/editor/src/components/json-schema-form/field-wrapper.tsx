import type { JsonSchema } from "@integramind/shared/types";
import { Alert, AlertDescription } from "@integramind/ui/alert";
import { Label } from "@integramind/ui/label";
import { Switch } from "@integramind/ui/switch";
import { FormField } from "./form-field";
import type { ValidationError } from "./types";

interface FieldWrapperProps {
  name: string;
  schema: JsonSchema;
  path: string;
  isRequired: boolean;
  isDisabled: boolean;
  value: unknown;
  errors: ValidationError[];
  onToggle: (path: string) => void;
  onChange: (path: string, value: unknown, schema: JsonSchema) => void;
}

export function FieldWrapper({
  name,
  schema,
  path,
  isRequired,
  isDisabled,
  value,
  errors,
  onToggle,
  onChange,
}: FieldWrapperProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label>
            {schema.title || name}
            {isRequired && <span className="ml-1 text-red-500">*</span>}
          </Label>
          {schema.description && (
            <p className="text-muted-foreground text-sm">
              {schema.description}
            </p>
          )}
        </div>
        {!isRequired && (
          <Switch
            checked={!isDisabled}
            onCheckedChange={() => onToggle(path)}
            aria-label={`Toggle ${schema.title || name}`}
          />
        )}
      </div>
      <FormField
        name={name}
        schema={schema}
        path={path}
        value={value}
        isDisabled={isDisabled}
        onChange={onChange}
      />
      {errors.map((error, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <Alert variant="destructive" key={index}>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
