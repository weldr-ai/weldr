import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { ProjectView } from "@/components/project-view";
import { CurrentVersionProvider } from "@/lib/context/current-version";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";
import type { NodeType } from "@weldr/shared/types";
import type { Edge } from "@xyflow/react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await api.projects.byId({ id: projectId });

  return { title: `${project.title ?? "Untitled Project"} - Weldr` };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ versionId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;
    const { versionId } = await searchParams;
    const project = await api.projects.byId({ id: projectId, versionId });
    const integrationTemplates = await api.integrationTemplates.list();

    const initialNodes: CanvasNode[] =
      project.currentVersion?.declarations?.reduce<CanvasNode[]>((acc, e) => {
        if (!e.declaration.specs) return acc;

        acc.push({
          id: e.declaration.nodeId ?? "",
          type: e.declaration.specs.data.type as NodeType,
          data: e.declaration,
          position: e.declaration.node?.position ?? {
            x: 0,
            y: 0,
          },
        });

        return acc;
      }, []) ?? [];

    const initialEdges: Edge[] =
      project.currentVersion?.edges?.map((edge) => ({
        id: `${edge.dependencyId}-${edge.dependentId}`,
        source: edge.dependencyId,
        target: edge.dependentId,
      })) ?? [];

    // Add sample endpoint node for demo/testing
    initialNodes.push({
      id: "sample-endpoint-1",
      type: "endpoint" as NodeType,
      data: {
        id: "sample-endpoint-1",
        nodeId: "sample-endpoint-1",
        progress: "pending",
        specs: {
          version: "v1",
          data: {
            type: "endpoint",
            method: "get",
            path: "/api/users/{userId}",
            summary: "Get user profile by ID",
            description:
              "Retrieves detailed information about a specific user including their profile data, preferences, and metadata.",
            tags: ["users", "profile"],
            parameters: [
              {
                name: "userId",
                in: "path",
                description: "The unique identifier of the user to retrieve",
                required: true,
                schema: {
                  type: "string",
                  pattern: "^[0-9a-fA-F]{24}$",
                  description: "MongoDB ObjectId format",
                },
              },
            ],
            responses: {
              "200": {
                description: "User profile retrieved successfully",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Unique user identifier",
                        },
                        email: {
                          type: "string",
                          format: "email",
                          description: "User's email address",
                        },
                        name: {
                          type: "string",
                          description: "User's display name",
                        },
                        createdAt: {
                          type: "string",
                          format: "date-time",
                          description: "Account creation timestamp",
                        },
                      },
                      required: ["id", "email", "name", "createdAt"],
                    },
                  },
                },
              },
              "404": {
                description: "User not found or access denied",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        error: { type: "string" },
                        code: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
            protected: true,
          },
        },
        node: {
          id: "sample-endpoint-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: projectId,
          position: { x: 200, y: 100 },
        },
      },
      position: { x: 200, y: 100 },
    });

    // Add sample db-model node for demo/testing
    initialNodes.push({
      id: "sample-db-model-1",
      type: "db-model" as NodeType,
      data: {
        id: "sample-db-model-1",
        nodeId: "sample-db-model-1",
        progress: "pending",
        specs: {
          version: "v1",
          data: {
            type: "db-model",
            name: "users",
            columns: [
              {
                name: "id",
                type: "varchar(36)",
                required: true,
                isPrimaryKey: true,
                unique: true,
                nullable: false,
              },
              {
                name: "email",
                type: "varchar(255)",
                required: true,
                nullable: false,
                unique: true,
              },
              {
                name: "name",
                type: "varchar(100)",
                required: true,
                nullable: false,
              },
              {
                name: "password_hash",
                type: "varchar(255)",
                required: true,
                nullable: false,
              },
              {
                name: "created_at",
                type: "timestamp",
                required: true,
                nullable: false,
                default: "CURRENT_TIMESTAMP",
              },
              {
                name: "updated_at",
                type: "timestamp",
                required: true,
                nullable: false,
                default: "CURRENT_TIMESTAMP",
              },
              {
                name: "avatar_url",
                type: "varchar(500)",
                required: false,
                nullable: true,
              },
              {
                name: "is_active",
                type: "boolean",
                required: true,
                nullable: false,
                default: true,
              },
            ],
            relationships: [
              {
                type: "oneToMany",
                referencedModel: "posts",
                referencedColumn: "user_id",
                onDelete: "CASCADE",
              },
            ],
            indexes: [
              {
                name: "idx_users_email",
                columns: ["email"],
                unique: true,
              },
              {
                name: "idx_users_created_at",
                columns: ["created_at"],
                unique: false,
              },
            ],
          },
        },
        node: {
          id: "sample-db-model-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: projectId,
          position: { x: 500, y: 100 },
        },
      },
      position: { x: 500, y: 100 },
    });

    // Add sample page nodes for demo/testing
    initialNodes.push({
      id: "sample-page-1",
      type: "page" as NodeType,
      data: {
        id: "sample-page-1",
        nodeId: "sample-page-1",
        progress: "completed",
        specs: {
          version: "v1",
          data: {
            type: "page",
            name: "User Dashboard",
            description:
              "Main dashboard page where users can view their account overview, recent activity, and quick actions.",
            route: "/dashboard",
            protected: true,
            meta: "Dashboard - Manage your account and view your activity",
          },
        },
        node: {
          id: "sample-page-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: projectId,
          position: { x: 100, y: 400 },
        },
      },
      position: { x: 100, y: 400 },
    });

    initialNodes.push({
      id: "sample-page-2",
      type: "page" as NodeType,
      data: {
        id: "sample-page-2",
        nodeId: "sample-page-2",
        progress: "in_progress",
        specs: {
          version: "v1",
          data: {
            type: "page",
            name: "User Profile",
            description:
              "Individual user profile page displaying detailed information, settings, and activity history for a specific user.",
            route: "/users/{userId}",
            protected: true,
            parameters: [
              {
                in: "path",
                name: "userId",
                description: "The unique identifier of the user",
                required: true,
                schema: {
                  type: "string",
                },
              },
            ],
            meta: "User Profile - View and manage user information",
          },
        },
        node: {
          id: "sample-page-2",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: projectId,
          position: { x: 400, y: 400 },
        },
      },
      position: { x: 400, y: 400 },
    });

    initialNodes.push({
      id: "sample-page-3",
      type: "page" as NodeType,
      data: {
        id: "sample-page-3",
        nodeId: "sample-page-3",
        progress: "completed",
        specs: {
          version: "v1",
          data: {
            type: "page",
            name: "Landing Page",
            description:
              "Public landing page showcasing features, pricing, and call-to-action for new visitors.",
            route: "/",
            protected: false,
            meta: "Welcome to Our Platform - Discover amazing features and get started today",
          },
        },
        node: {
          id: "sample-page-3",
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId: projectId,
          position: { x: 700, y: 400 },
        },
      },
      position: { x: 700, y: 400 },
    });

    initialEdges.push({
      id: "sample-endpoint-1-sample-db-model-1",
      source: "sample-endpoint-1",
      target: "sample-db-model-1",
    });

    // Add edges connecting page to endpoint and db-model
    initialEdges.push({
      id: "sample-page-2-sample-endpoint-1",
      source: "sample-page-2",
      target: "sample-endpoint-1",
    });

    initialEdges.push({
      id: "sample-page-1-sample-db-model-1",
      source: "sample-page-1",
      target: "sample-db-model-1",
    });

    return (
      <CurrentVersionProvider currentVersion={project.currentVersion}>
        <ProjectView
          project={project}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          integrationTemplates={integrationTemplates}
        />
      </CurrentVersionProvider>
    );
  } catch (error) {
    console.error(error);
    if (error instanceof TRPCError) {
      switch (error.code) {
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: notFound function already returns
        case "NOT_FOUND":
          notFound();
        case "UNAUTHORIZED":
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: redirect function already returns
        case "FORBIDDEN":
          redirect("/auth/sign-in");
        default:
          return <div>Error</div>;
      }
    }
    return <div>Error</div>;
  }
}
