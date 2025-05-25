import { applyEdits, findFilename, getEdits } from "./editor";
import type { FileCache } from "./file-cache";

// Mock FileCache implementation for testing
class MockFileCache {
  private cache: Map<string, string> = new Map();

  async getFile({
    projectId,
    path,
  }: { projectId: string; path: string; versionId?: string }): Promise<
    string | undefined
  > {
    const key = `${projectId}:${path}`;
    return this.cache.get(key);
  }

  setFile({
    projectId,
    path,
    content,
  }: { projectId: string; path: string; content: string }): void {
    const key = `${projectId}:${path}`;
    this.cache.set(key, content);
  }
}

// Test the SEARCH/REPLACE functionality with more complex scenarios
const testContent = `
src/utils/helpers.ts

\`\`\`
<<<<<<< SEARCH
function oldFunction() {
  return "old";
}

function anotherOldFunction() {
  return "another old";
}
=======
function newFunction() {
  return "new";
}

function anotherNewFunction() {
  return "another new";
}
>>>>>>> REPLACE
\`\`\`

Now I will create a new file called src/components/Button.tsx

src/components/Button.tsx

\`\`\`
<<<<<<< SEARCH
const Button = () => {
  return <button>Click me</button>;
};
=======
const Button = () => {
  return <button className="btn">Click me</button>;
};
>>>>>>> REPLACE
\`\`\`

src/components/Button.tsx

\`\`\`
<<<<<<< SEARCH
export default Button;
=======
export { Button };
>>>>>>> REPLACE
\`\`\

src/utils/helpers.ts

\`\`\`
<<<<<<< SEARCH
// Helper constants
const OLD_CONSTANT = "old";
const ANOTHER_OLD_CONSTANT = "another old";
=======
// Updated constants
const NEW_CONSTANT = "new";
const ANOTHER_NEW_CONSTANT = "another new";
>>>>>>> REPLACE
\`\`\`


src/types/api.ts


\`\`\`
<<<<<<< SEARCH
=======
export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    theme: "light" | "dark";
    notifications: boolean;
    language: string;
  };
}

export interface ApiResponse<T> {
  data: T;
  status: "success" | "error";
  message?: string;
}
>>>>>>> REPLACE

\`\`\`

src/components/ComplexForm.tsx

\`\`\`
<<<<<<< SEARCH
=======
import type React from "react";
import { useCallback, useState } from "react";
import type { User } from "../types/api";

interface FormProps {
  user?: User;
  onSubmit: (data: Partial<User>) => Promise<void>;
  className?: string;
}

export const ComplexForm: React.FC<FormProps> = ({
  user,
  onSubmit,
  className = "",
}) => {
  const [formData, setFormData] = useState<Partial<User>>({
    name: user?.name || "",
    email: user?.email || "",
    preferences: {
      theme: user?.preferences?.theme || "light",
      notifications: user?.preferences?.notifications ?? true,
      language: user?.preferences?.language || "en",
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await onSubmit(formData);
      } catch (error) {
        console.error("Form submission failed:", error);
      }
    },
    [formData, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit}
  className = { \`form-container \${className };
  \`
};
>
      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          id="name"
type = "text";
value={formData.name || ''}
onChange={(e) => setFormData(prev => ({
            ...prev,
            name: e.target.value
          }
))}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
type = "email";
value={formData.email || ''}
onChange={(e) => setFormData(prev => ({
            ...prev,
            email: e.target.value
          }
))}
          required
        />
      </div>

      <fieldset className="preferences-group">
        <legend>Preferences</legend>

        <div className="form-group">
          <label htmlFor="theme">Theme</label>
          <select
            id="theme"
            value=
{
  formData.preferences?.theme || "light";
}
onChange={(e) => setFormData(prev => ({
              ...prev,
              preferences: {
                ...prev.preferences,
                theme: e.target.value as 'light' | 'dark'
              }
            }
))}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="form-group">
          <label>
            <input
type = "checkbox";
checked={formData.preferences?.notifications ?? true}
onChange={(e) => setFormData(prev => ({
                ...prev,
                preferences: {
                  ...prev.preferences,
                  notifications: e.target.checked
                }
              }
))}
            />
            Enable notifications
          </label>
        </div>
      </fieldset>

      <button
type = "submit";
className="submit-btn">
        {user ? 'Update Profile' : 'Create Profile'}
      </button>
    </form>
)
}
>>>>>>> REPLACE
\`\`\`

src/utils/config.ts

\`\`\`
<<<<<<< SEARCH
export const config = {
  api: {
    baseUrl: "http://localhost:3000",
    timeout: 5000,
  },
};
=======
export const config = {
  api: {
    baseUrl:
      process.env.NODE_ENV === "production"
        ? "https://api.production.com"
        : "http://localhost:3000",
    timeout: 10000,
    retries: 3,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  },
  app: {
    name: "Weldr Editor",
    version: "1.0.0",
    features: {
      darkMode: true,
      notifications: true,
      analytics: process.env.NODE_ENV === "production",
    },
  },
};
>>>>>>> REPLACE
\`\`\`

src/components/Button.tsx

\`\`\`
<<<<<<< SEARCH
import React from "react";

const Button = () => {
  return <button className="btn">Click me</button>;
};

export { Button };
=======
import { clsx } from "clsx";
import type React from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  onClick,
  className = '',
}) => {
  const buttonClasses = clsx(
    'btn',
    \`btn--\${variant}\`,
    \`btn--\${size}\`,
    {
      'btn--disabled': disabled,
      'btn--loading': loading,
    },
    className
  );

  return (
    <button
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading ? (
        <span className="btn__spinner">Loading...</span>
      ) : (
        children
      )}
    </button>
  );
};
>>>>>>> REPLACE
\`\`\`

src/hooks/useApi.ts

\`\`\`

<<<<<<< SEARCH
=======
import { useState, useCallback } from 'react';
import { config } from '../utils/config';
import type { ApiResponse } from '../types/api';

interface UseApiOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export function useApi(options: UseApiOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const url = \`\${options.baseUrl || config.api.baseUrl}\${endpoint}\`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...config.api.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(<T>(endpoint: string) =>
    request<T>(endpoint, { method: 'GET' }), [request]);

  const post = useCallback(<T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }), [request]);

  const put = useCallback(<T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }), [request]);

  const del = useCallback(<T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }), [request]);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
  };
}
>>>>>>> REPLACE
\`\`\`
src/utils/helpers.ts
\`\`\`
<<<<<<< SEARCH
export { oldFunction, anotherOldFunction };
=======
export { newFunction, anotherNewFunction };

// Utility functions
export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
>>>>>>> REPLACE
\`\`\`

src/utils/whitespace-test.ts

\`\`\`
<<<<<<< SEARCH
function badWhitespace() {
  return "this will fail";
}
=======
function goodWhitespace() {
  return "this should work";
}
>>>>>>> REPLACE
\`\`\`
`;

// Sample file contents that match the original parts of our edits
const sampleFiles = {
  "src/utils/helpers.ts": `// Helper constants
const OLD_CONSTANT = "old";
const ANOTHER_OLD_CONSTANT = "another old";

function oldFunction() {
  return "old";
}

function anotherOldFunction() {
  return "another old";
}

export { oldFunction, anotherOldFunction };`,

  "src/components/Button.tsx": `import React from "react";

const Button = () => {
  return <button>Click me</button>;
};

export default Button;`,

  "src/utils/config.ts": `export const config = {
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
  },
};`,

  "src/utils/whitespace-test.ts": `// This file tests whitespace sensitivity
    function badWhitespace() {
    return "this will fail";
}

// More content here
const someVariable = "test";`,
};

async function testGetEdits() {
  console.log("=== Testing getEdits ===");
  try {
    const edits = getEdits({ content: testContent });
    console.log("Parsed edits:", JSON.stringify(edits, null, 2));
    return edits;
  } catch (error) {
    console.error("Error parsing edits:", error);
    return [];
  }
}

async function testApplyEdits() {
  console.log("\n=== Testing applyEdits ===");

  // First, get the edits
  const edits = getEdits({ content: testContent });

  // Create mock file cache and populate it with sample files
  const fileCache = new MockFileCache();
  const projectId = "test-project";

  // Set up existing files in the cache
  for (const [path, content] of Object.entries(sampleFiles)) {
    fileCache.setFile({ projectId, path, content });
  }

  // List of existing files
  const existingFiles = Object.keys(sampleFiles);

  try {
    const result = await applyEdits({
      existingFiles,
      edits,
      projectId,
      fileCache: fileCache as unknown as FileCache,
    });

    console.log("Apply edits result:");
    console.log("Passed edits:", result.passed.length);
    console.log("Failed edits:", result.failed.length);

    if (result.passed.length > 0) {
      console.log("\n--- Successful edits ---");
      result.passed.forEach((edit, index) => {
        console.log(`\n=== PASSED EDIT ${index + 1}: ${edit.path} ===`);
        console.log("ORIGINAL CONTENT:");
        console.log("─".repeat(50));
        console.log(edit.original);
        console.log("─".repeat(50));
        console.log("UPDATED CONTENT:");
        console.log("─".repeat(50));
        console.log(edit.updated);
        console.log("─".repeat(50));
      });
    }

    if (result.failed.length > 0) {
      console.log("\n--- Failed edits ---");
      result.failed.forEach((failedEdit, index) => {
        console.log(
          `\n=== FAILED EDIT ${index + 1}: ${failedEdit.edit.path} ===`,
        );
        console.log("ERROR:", failedEdit.error);
        console.log("ORIGINAL SEARCH TEXT:");
        console.log("─".repeat(30));
        console.log(failedEdit.edit.original);
        console.log("─".repeat(30));
        console.log("INTENDED REPLACEMENT:");
        console.log("─".repeat(30));
        console.log(failedEdit.edit.updated);
        console.log("─".repeat(30));
      });
    }

    return result;
  } catch (error) {
    console.error("Error applying edits:", error);
    return { passed: [], failed: [] };
  }
}

async function runTests() {
  console.log("Starting editor tests...\n");

  // Test parsing
  const edits = await testGetEdits();

  // Test applying
  const applyResult = await testApplyEdits();

  console.log("\n=== Test Summary ===");
  console.log(`Parsed ${edits.length} edits`);
  console.log(`Applied ${applyResult.passed.length} edits successfully`);
  console.log(`Failed to apply ${applyResult.failed.length} edits`);

  const filename = findFilename({
    lines: `src/utils/helpers.ts

\`\`\`
<<<<<<< SEARCH
function oldFunction() {
  return "old";
}

function anotherOldFunction() {
  return "another old";
}
=======
function newFunction() {
  return "new";
}

function anotherNewFunction() {
  return "another new";
}
>>>>>>> REPLACE
\`\`\`

Now I will create a new file called src/components/Button.tsx

src/components/Button.tsx

\`\`\`
<<<<<<< SEARCH
const Button = () => {
  return <button>Click me</button>;
};
=======
const Button = () => {
  return <button className="btn">Click me</button>;
};
>>>>>>> REPLACE
\`\`\``.split("\n"),
  });

  console.log("Filename:", filename);
}

// Run the tests
runTests().catch(console.error);
