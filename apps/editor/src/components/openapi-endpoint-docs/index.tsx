"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@weldr/ui/accordion";
import { Badge } from "@weldr/ui/badge";
import { Button } from "@weldr/ui/button";
import { cn } from "@weldr/ui/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
import { nanoid } from "nanoid";
import type { OpenAPIV3 } from "openapi-types";
import { useState } from "react";
import {
  type ParsedSchema,
  getResponseSchema,
  parseOpenApiEndpoint,
  parseSchema,
} from "./utils";

interface OpenApiEndpointDocsProps {
  spec: OpenAPIV3.Document | null;
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
    <div className="flex items-baseline border-b py-2 last:border-0">
      <div className="flex-1">
        <div className="flex flex-col gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs">{name}</span>
              <span className="text-muted-foreground text-xs">
                {renderType()}
              </span>
              {required && (
                <span className="text-destructive text-xs">required</span>
              )}
            </div>
            {schema.description && (
              <p className="text-muted-foreground text-xs">
                {schema.description}
              </p>
            )}
          </div>
          {hasChildren && (
            <div className="flex items-center justify-start gap-2 text-xs">
              <Button
                variant="outline"
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <MinusIcon className="mr-1 size-3" />
                ) : (
                  <PlusIcon className="mr-1 size-3" />
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
  if (!spec) {
    return (
      <div className="flex h-[calc(100dvh-432px)] items-center justify-center text-center text-muted-foreground text-xs">
        Chat with Weldr to generate the endpoint
      </div>
    );
  }

  const { path, method, operation } = parseOpenApiEndpoint(spec);

  const requestBodySchema = operation.requestBody
    ? (operation.requestBody as OpenAPIV3.RequestBodyObject).content[
        "application/json"
      ]?.schema
    : undefined;

  const requestBodyExample = operation.requestBody
    ? (operation.requestBody as OpenAPIV3.RequestBodyObject).content[
        "application/json"
      ]?.example
    : undefined;

  const parsedRequestBody = requestBodySchema
    ? parseSchema(requestBodySchema as OpenAPIV3.SchemaObject)
    : undefined;

  const hasResponses = operation.responses
    ? Object.keys(operation.responses).length > 0
    : false;

  const hasParameters = operation.parameters && operation.parameters.length > 0;
  const hasSecurity = operation.security && operation.security.length > 0;
  const hasContent = parsedRequestBody || hasResponses || hasParameters;

  // Group parameters by their location (in)
  const groupedParameters = operation.parameters?.reduce(
    (acc, param) => {
      const parameter = param as OpenAPIV3.ParameterObject;
      const location = parameter.in;
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(parameter);
      return acc;
    },
    {} as Record<string, OpenAPIV3.ParameterObject[]>,
  );

  return (
    <div className="w-full space-y-2">
      {/* Header */}
      <div className="flex flex-col items-start gap-2">
        {/* Method and Path */}
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge
              className={cn("px-1.5 py-0.5 font-semibold text-xs uppercase", {
                "bg-primary/30 text-primary hover:bg-primary/30":
                  method === "get",
                "bg-success/30 text-success hover:bg-success/30":
                  method === "post",
                "bg-warning/30 text-warning hover:bg-warning/30":
                  method === "put" || method === "patch",
                "bg-destructive/30 text-destructive hover:bg-destructive/30":
                  method === "delete",
              })}
            >
              {method}
            </Badge>
            <span className="text-xs">{path}</span>
          </div>
        </div>
        {operation.description && (
          <p className="whitespace-pre-wrap text-muted-foreground text-xs">
            {operation.description}
          </p>
        )}
        {operation.tags && operation.tags.length > 0 && (
          <div className="flex gap-1">
            {operation.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-full items-center justify-center rounded-md border px-1.5 py-0.5 font-semibold text-[10px]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasContent ? (
        <div className="space-y-4">
          {/* Parameters */}
          {hasParameters && (
            <div>
              <span className="font-semibold">Parameters</span>
              <Accordion type="multiple" className="w-full">
                {Object.entries(groupedParameters || {}).map(
                  ([location, params]) => (
                    <AccordionItem key={location} value={location}>
                      <AccordionTrigger className="py-2 text-xs hover:no-underline">
                        {location.charAt(0).toUpperCase() + location.slice(1)}{" "}
                        Parameters
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="space-y-2">
                          {params.map((parameter) => (
                            <div
                              key={parameter.name}
                              className="flex items-baseline border-b py-2 last:border-0"
                            >
                              <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs">
                                    {parameter.name}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {
                                      (
                                        parameter.schema as OpenAPIV3.SchemaObject
                                      )?.type
                                    }
                                  </span>
                                  {parameter.required && (
                                    <span className="text-destructive text-xs">
                                      required
                                    </span>
                                  )}
                                </div>
                                {parameter.description && (
                                  <p className="text-muted-foreground text-xs">
                                    {parameter.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ),
                )}
              </Accordion>
            </div>
          )}

          {/* Request Body */}
          {parsedRequestBody && (
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Body</span>
                <span className="items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px]">
                  application/json
                </span>
              </div>
              {Object.entries(parsedRequestBody.properties || {}).map(
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
              {requestBodyExample && (
                <div className="mt-2">
                  <span className="font-semibold text-sm">Example:</span>
                  <pre className="mt-2 rounded-lg bg-muted p-4 text-xs">
                    {JSON.stringify(requestBodyExample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Responses */}
          {hasResponses && (
            <div>
              <span className="font-semibold">Responses</span>
              <Accordion type="multiple">
                {Object.entries(operation.responses).map(([code, response]) => {
                  const responseSchema = getResponseSchema(operation, code);
                  const parsedSchema = responseSchema
                    ? parseSchema(responseSchema as OpenAPIV3.SchemaObject)
                    : undefined;
                  const responseObj = response as OpenAPIV3.ResponseObject;
                  const example =
                    responseObj.content?.["application/json"]?.example;

                  return (
                    <AccordionItem
                      key={code}
                      value={code}
                      className="last:border-0"
                    >
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">
                        <div className="flex items-center space-x-2 text-xs">
                          <span>{code}</span>
                          <span>{responseObj.description}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <p className="text-muted-foreground text-xs">
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
                        {example && (
                          <div>
                            <span className="font-semibold text-sm">
                              Example:
                            </span>
                            <pre className="mt-2 rounded-lg bg-muted p-4 text-xs">
                              {JSON.stringify(example, null, 2)}
                            </pre>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}

          {/* Security */}
          {hasSecurity && (
            <div>
              <span className="font-semibold">Security</span>
              <div className="mt-2 flex flex-col gap-2">
                {operation.security?.map((security) => (
                  <div
                    key={nanoid()}
                    className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-3"
                  >
                    {Object.entries(security).map(([scheme, scopes]) => (
                      <div key={scheme} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {scheme}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {scheme === "bearerAuth"
                              ? "Bearer Token Authentication"
                              : scheme}
                          </span>
                        </div>
                        {scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {scopes.map((scope) => (
                              <span key={scope} className="text-xs">
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          This endpoint has not been fully defined yet
        </div>
      )}
    </div>
  );
}
