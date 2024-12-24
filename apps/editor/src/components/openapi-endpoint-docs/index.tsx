"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@integramind/ui/accordion";
import { Badge } from "@integramind/ui/badge";
import { Button } from "@integramind/ui/button";
import { cn } from "@integramind/ui/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
import type { OpenAPIV3 } from "openapi-types";
import { useState } from "react";
import {
  type ParsedSchema,
  getResponseSchema,
  parseOpenApiEndpoint,
  parseSchema,
} from "~/lib/openapi-utils";

interface OpenApiEndpointDocsProps {
  spec: OpenAPIV3.Document;
}

function SchemaField({
  name,
  schema,
  required,
  level = 0,
}: {
  name: string;
  schema: ParsedSchema;
  required: boolean;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderType = () => {
    if (schema.type === "array") {
      return `array ${schema.items?.type}[]`;
    }
    return schema.format ? `${schema.type} · ${schema.format}` : schema.type;
  };

  const hasChildren =
    (schema.type === "object" &&
      schema.properties &&
      Object.keys(schema.properties).length > 0) ||
    (schema.type === "array" && schema.items);

  return (
    <div className="flex items-baseline py-2 border-b last:border-0">
      <div className="flex-1 space-y-1">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs">{name}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {renderType()}
            </span>
            {required && (
              <span className="text-xs text-destructive">required</span>
            )}
            {schema.description && (
              <span className="text-xs text-muted-foreground">
                {schema.description}
              </span>
            )}
          </div>
          {hasChildren && (
            <div className="flex justify-start items-center gap-2 text-xs">
              <Button
                variant="outline"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground hover:text-foreground rounded-full"
              >
                {isExpanded ? (
                  <MinusIcon className="size-3 mr-1" />
                ) : (
                  <PlusIcon className="size-3 mr-1" />
                )}
                {isExpanded ? "Hide" : "Show"} Child Attributes
              </Button>
            </div>
          )}
        </div>

        {(schema.type === "object" || schema.type === "array") && (
          <div className="mt-2 space-y-2">
            {isExpanded &&
              schema.type === "object" &&
              schema.properties &&
              Object.entries(schema.properties).map(([key, value]) => (
                <SchemaField
                  key={key}
                  name={key}
                  schema={value as ParsedSchema}
                  required={schema.required?.includes(key) || false}
                  level={level + 1}
                />
              ))}

            {isExpanded && schema.type === "array" && schema.items && (
              <SchemaField
                name={`${name}[]`}
                schema={schema.items}
                required={false}
                level={level + 1}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OpenApiEndpointDocs({
  spec,
}: OpenApiEndpointDocsProps) {
  const { path, method, operation } = parseOpenApiEndpoint(spec);

  const requestBodySchema = operation.requestBody
    ? (operation.requestBody as OpenAPIV3.RequestBodyObject).content[
        "application/json"
      ]?.schema
    : undefined;

  const parsedRequestBody = requestBodySchema
    ? parseSchema(requestBodySchema as OpenAPIV3.SchemaObject)
    : undefined;

  const hasResponses = operation.responses
    ? Object.keys(operation.responses).length > 0
    : false;

  const hasParameters = operation.parameters && operation.parameters.length > 0;

  const hasContent = parsedRequestBody || hasResponses || hasParameters;

  return (
    <div className="w-full font-[system-ui] space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-medium">{operation.summary || path}</h1>
        <p className="text-muted-foreground">{operation.description}</p>
      </div>

      {/* Method and Path */}
      <div className="flex items-center space-x-2">
        <Badge
          className={cn("text-xs uppercase font-bold px-1.5 py-0.5", {
            "bg-primary/30 hover:bg-primary/30 text-primary": method === "get",
            "bg-success/30 hover:bg-success/30 text-success": method === "post",
            "bg-warning/30 hover:bg-warning/30 text-warning":
              method === "put" || method === "patch",
            "bg-destructive/30 hover:bg-destructive/30 text-destructive":
              method === "delete",
          })}
        >
          {method}
        </Badge>
        <span className="font-mono text-xs">{path}</span>
      </div>

      {hasContent ? (
        <>
          {/* Parameters */}
          {hasParameters && (
            <div className="space-y-2">
              <span>Parameters</span>
              <div className="space-y-2">
                {operation.parameters?.map((param) => {
                  const parameter = param as OpenAPIV3.ParameterObject;
                  return (
                    <div
                      key={parameter.name}
                      className="flex items-baseline py-2 border-b last:border-0"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs">
                            {parameter.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {parameter.in}
                          </span>
                          {parameter.required && (
                            <span className="text-xs text-destructive">
                              required
                            </span>
                          )}
                          {parameter.description && (
                            <span className="text-xs text-muted-foreground">
                              {parameter.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Request Body */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span>Body</span>
              {parsedRequestBody && (
                <span className="items-center justify-center text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                  application/json
                </span>
              )}
            </div>
            {parsedRequestBody &&
              Object.entries(parsedRequestBody.properties || {}).map(
                ([key, value]) => (
                  <SchemaField
                    key={key}
                    name={key}
                    schema={value as ParsedSchema}
                    required={
                      parsedRequestBody.required?.includes(key) || false
                    }
                  />
                ),
              )}
          </div>

          {/* Responses */}
          <div className="space-y-2">
            <span>Responses</span>
            {hasResponses && (
              <Accordion type="multiple">
                {Object.entries(operation.responses).map(([code, response]) => {
                  const responseSchema = getResponseSchema(operation, code);
                  const parsedSchema = responseSchema
                    ? parseSchema(responseSchema as OpenAPIV3.SchemaObject)
                    : undefined;
                  const responseObj = response as OpenAPIV3.ResponseObject;

                  return (
                    <AccordionItem
                      key={code}
                      value={code}
                      className="last:border-0"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center space-x-4">
                          <span className="font-mono text-xs">{code}</span>
                          <span className="text-xs">
                            {responseObj.description}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {responseObj.description}
                        </p>
                        <div>
                          {parsedSchema?.properties &&
                            Object.entries(parsedSchema.properties).map(
                              ([key, value]) => (
                                <SchemaField
                                  key={key}
                                  name={key}
                                  schema={value as ParsedSchema}
                                  required={
                                    parsedSchema.required?.includes(key) ||
                                    false
                                  }
                                />
                              ),
                            )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          This endpoint has not been fully defined yet
        </div>
      )}
    </div>
  );
}
