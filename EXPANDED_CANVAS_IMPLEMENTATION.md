# Expanded Canvas Implementation

## Overview

I've implemented the expanded canvas view for declarations as requested. This feature allows users to view the high-level declarations (pages, endpoints, and db models) on the main canvas, and then expand specific nodes to see their dependencies and integrations in a dedicated dialog.

## Features Implemented

### 1. Expand Button on Node Cards
- Added a zoom-in button (🔍) to the header of each declaration node
- Button appears on hover for page nodes
- Button is always visible in the expanded view for endpoint and db-model nodes
- Clicking the button opens the expanded canvas dialog

### 2. Simple Expanded Canvas Dialog
- **File**: `apps/web/src/components/canvas/simple-expanded-canvas.tsx`
- Full-screen modal dialog that shows dependency relationships
- Center node represents the main declaration
- Surrounding circular nodes represent dependencies
- Connected with animated dashed lines

### 3. Circle Node Visualization
- Dependencies are arranged in a circle around the main declaration
- Each dependency is shown as a circular node with its name
- Nodes are clickable and show selection state
- Clean, minimal design focused on relationships

### 4. Integration Badges
- Integration badges are displayed in the top-right of the dialog header
- Shows which integrations (PostgreSQL, Redis, etc.) are used by the declaration
- Currently shows mock data but ready for real API integration

### 5. Declaration Details Popup
- Clicking any node shows a details card in the bottom-right
- Shows declaration name, type, and relevant metadata
- Includes close button (×) to dismiss
- Scrollable content area for longer descriptions

### 6. API Endpoints Added
- **File**: `packages/api/src/router/declarations.ts`
- Added `getDependencies` endpoint to fetch declaration dependencies
- Added `getIntegrations` endpoint to fetch declaration integrations
- Both endpoints include proper authorization checks

## Implementation Details

### Node Integration
- **Page Node** (`page.tsx`): Added expand button to header with dependency view
- **Endpoint Node** (`endpoint.tsx`): Added expand button in expanded view header
- **DB Model Node** (`db-model.tsx`): Added expand button in expanded view header

### State Management
- Each node has its own `expandedCanvasOpen` state
- Dialog state is managed locally within each node component
- Clean separation between main canvas and expanded canvas states

### Styling Approach
- Used inline styles in the simple canvas to avoid dependency issues
- Responsive design that works on different screen sizes
- Consistent with existing design system colors and spacing
- Dark mode considerations built in

## Current Status

### ✅ Completed
- Expand buttons on all declaration node types
- Basic expanded canvas dialog with SVG visualization
- Circle node layout with dependency connections
- Integration badges display
- Declaration details popup
- API endpoints for dependencies and integrations

### 🔄 Ready for Enhancement
- **Real Data Integration**: Currently uses mock data, ready to connect to actual API
- **Advanced Layouts**: Can be enhanced with more sophisticated node positioning
- **Animation**: Basic animations in place, can be enhanced
- **Filtering**: Foundation for filtering dependencies by type
- **Search**: Structure supports adding search functionality

## Usage

1. **View Main Canvas**: See high-level declarations (pages, endpoints, db models)
2. **Expand Node**: Click the zoom-in button on any declaration node
3. **Explore Dependencies**: View the dependency graph in the expanded canvas
4. **View Details**: Click any node to see detailed information
5. **See Integrations**: Integration badges show what services are used

## Technical Architecture

```
Main Canvas (ReactFlow)
├── Page Nodes (with expand button)
├── Endpoint Nodes (with expand button)  
├── DB Model Nodes (with expand button)
└── SimpleExpandedCanvas Dialog
    ├── SVG Visualization
    ├── Circle Nodes
    ├── Integration Badges
    └── Details Popup
```

## Next Steps

1. **Connect Real Data**: Replace mock data with actual API calls
2. **Enhanced Styling**: Add proper UI component integration when modules are available
3. **Performance**: Add virtualization for large dependency graphs
4. **Interactions**: Add drag-and-drop, zoom, and pan to expanded canvas
5. **Export**: Add ability to export dependency graphs

The implementation provides a solid foundation for viewing declaration dependencies and can be easily extended with additional features as needed.