"use client";

import {
  getParameterFields,
  getRequestBodySchema,
  parseOpenApiSpec,
} from "@/lib/openapi-utils";
import { Button } from "@integramind/ui/button";
import { Input } from "@integramind/ui/input";
import { Label } from "@integramind/ui/label";
import { Textarea } from "@integramind/ui/textarea";
import type { OpenAPIV3 } from "openapi-types";
import { useState } from "react";

interface OpenApiRendererProps {
  spec: OpenAPIV3.Document;
}

export function OpenApiRenderer({ spec }: OpenApiRendererProps) {
  const operation = parseOpenApiSpec(spec);
  const parameters = getParameterFields(operation);
  const requestBodySchema = getRequestBodySchema(operation);

  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [bodyValue, setBodyValue] = useState("");

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Parameters:", paramValues);
    console.log("Request Body:", bodyValue);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="font-bold text-2xl">
        {operation.summary || "API Endpoint"}
      </h2>

      {parameters.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-xl">Parameters</h3>
          {parameters.map(
            (param, index) =>
              "name" in param && (
                <div key={param.name} className="space-y-2">
                  <Label htmlFor={param.name}>{param.name}</Label>
                  <Input
                    id={param.name}
                    placeholder={param.description || ""}
                    value={paramValues[param.name] || ""}
                    onChange={(e) =>
                      handleParamChange(param.name, e.target.value)
                    }
                  />
                </div>
              ),
          )}
        </div>
      )}

      {requestBodySchema && (
        <div className="space-y-2">
          <h3 className="font-semibold text-xl">Request Body</h3>
          <Textarea
            placeholder="Enter JSON request body"
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
            rows={10}
          />
        </div>
      )}

      <Button type="submit">Send Request</Button>
    </form>
  );
}
