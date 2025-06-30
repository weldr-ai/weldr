"use client";

import { useState } from "react";

interface SimpleExpandedCanvasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  declarationName: string;
}

export function SimpleExpandedCanvas({
  open,
  onOpenChange,
  declarationName,
}: SimpleExpandedCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  if (!open) return null;

  // Mock data for now - this will be replaced with real API calls
  const mockDependencies = [
    { id: "1", name: "User Model", type: "db-model" },
    { id: "2", name: "Auth Service", type: "service" },
    { id: "3", name: "API Endpoint", type: "endpoint" },
  ];

  const mockIntegrations = [
    { id: "1", name: "PostgreSQL" },
    { id: "2", name: "Redis" },
  ];

  return (
    <div 
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          width: "90vw",
          height: "80vh",
          maxWidth: "1200px",
          padding: "24px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: "20px", borderBottom: "1px solid #e5e7eb", paddingBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
              Dependencies: {declarationName}
            </h2>
            <div style={{ display: "flex", gap: "8px" }}>
              {mockIntegrations.map((integration) => (
                <span
                  key={integration.id}
                  style={{
                    backgroundColor: "#f3f4f6",
                    color: "#374151",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                  }}
                >
                  {integration.name}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, position: "relative", backgroundColor: "#f9fafb", borderRadius: "4px" }}>
          <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
            {/* Center node (main declaration) */}
            <circle
              cx="50%"
              cy="50%"
              r="40"
              fill="#3b82f6"
              stroke="#1d4ed8"
              strokeWidth="2"
              style={{ cursor: "pointer" }}
              onClick={() => setSelectedNode("main")}
            />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dy="0.3em"
              fill="white"
              fontSize="12"
              style={{ pointerEvents: "none" }}
            >
              {declarationName.slice(0, 8)}
            </text>

            {/* Dependency nodes */}
            {mockDependencies.map((dep, index) => {
              const angle = (index * 2 * Math.PI) / mockDependencies.length;
              const radius = 120;
              const centerX = window.innerWidth * 0.45; // Approximate center
              const centerY = window.innerHeight * 0.4;
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);

              return (
                <g key={dep.id}>
                  {/* Connection line */}
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke="#6b7280"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                  {/* Node circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r="30"
                    fill={selectedNode === dep.id ? "#10b981" : "#6b7280"}
                    stroke="#374151"
                    strokeWidth="2"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedNode(dep.id)}
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dy="0.3em"
                    fill="white"
                    fontSize="10"
                    style={{ pointerEvents: "none" }}
                  >
                    {dep.name.slice(0, 6)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Details popup */}
          {selectedNode && (
            <div
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                backgroundColor: "white",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "16px",
                width: "300px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", margin: 0 }}>
                  {selectedNode === "main" 
                    ? declarationName 
                    : mockDependencies.find(d => d.id === selectedNode)?.name || "Unknown"
                  }
                </h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "16px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px 0" }}>
                {selectedNode === "main" 
                  ? "page" 
                  : mockDependencies.find(d => d.id === selectedNode)?.type || "unknown"
                }
              </p>
              <div style={{ fontSize: "12px", color: "#374151" }}>
                {selectedNode === "main" ? (
                  <p>This is the main page declaration that depends on the surrounding nodes.</p>
                ) : (
                  <p>This is a dependency required by the main declaration.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}