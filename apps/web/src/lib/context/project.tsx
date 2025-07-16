"use client";

import type { RouterOutputs } from "@weldr/api";
import type { Project, Version } from "@weldr/shared/types";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type PartialProject = Partial<Project & { currentVersion: Partial<Version> }>;

interface ProjectContextType {
  project: RouterOutputs["projects"]["byId"] | null;
  updateProjectData: (data: PartialProject) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export function ProjectProvider({
  children,
  project,
}: {
  children: ReactNode;
  project: RouterOutputs["projects"]["byId"];
}) {
  const [projectData, setProjectData] =
    useState<RouterOutputs["projects"]["byId"]>(project);

  useEffect(() => {
    setProjectData(project);
  }, [project]);

  return (
    <ProjectContext.Provider
      value={{
        project: projectData,
        updateProjectData: (data: PartialProject) => {
          setProjectData((prev) => {
            if (!prev) return prev;

            // Handle simple field updates
            const updated = { ...prev };

            // Update simple fields
            if (data.title !== undefined) updated.title = data.title;
            if (data.initiatedAt !== undefined)
              updated.initiatedAt = data.initiatedAt;

            // Handle currentVersion updates separately
            if (data.currentVersion) {
              updated.currentVersion = {
                ...prev.currentVersion,
                ...data.currentVersion,
              };
            }

            return updated;
          });
        },
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
