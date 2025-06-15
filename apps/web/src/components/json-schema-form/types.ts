import type { JsonSchema } from "@weldr/shared/types";

export interface ValidationError {
  path: string;
  message: string;
}

export interface RecordValue {
  [key: string]: unknown | RecordValue | Array<unknown | RecordValue>;
}

export interface FormFieldProps {
  name: string;
  schema: JsonSchema;
  path: string;
  value: unknown;
  isDisabled: boolean;
  onChange: (path: string, value: unknown, schema: JsonSchema) => void;
}
