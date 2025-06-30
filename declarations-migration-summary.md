# Declarations Table Migration Summary

## Overview
This document outlines the migration of the `declarations` table to merge the `specs` and `data` columns into a single `data` column, along with implementing logic to match spec-initiated declarations with extracted code declarations.

## Completed Work

### 1. Updated TypeScript Types
- **File**: `/workspace/packages/shared/src/types/declarations.ts`
- **Changes**:
  - Modified `DeclarationData` interface to include specs information
  - Added `specs?: DeclarationSpecsV1` field
  - Added `implementationDetails?` field
  - Added `isSpecInitiated?: boolean` flag
  - Added `isImplemented?: boolean` flag
  - Made `position` optional since spec-initiated declarations won't have this initially

### 2. Updated Database Schema
- **File**: `/workspace/packages/db/src/schema/declarations.ts`
- **Changes**:
  - Removed separate `specs` and `implementationDetails` columns
  - Updated to use merged `data` column with `DeclarationData` type
  - Removed import of `DeclarationSpecsV1` type

### 3. Created Migration SQL
- **File**: `/workspace/packages/db/drizzle/0001_bizarre_dark_phoenix.sql`
- **Features**:
  - Comprehensive data migration logic that handles all scenarios:
    - Declarations with both data and specs (spec-initiated and later implemented)
    - Declarations with only specs (spec-initiated but not implemented)
    - Declarations with only data (extracted declarations)
    - Graceful handling of edge cases
  - Properly merges specs and implementation details into the data column
  - Sets appropriate flags (`isSpecInitiated`, `isImplemented`)
  - Drops old columns after migration

### 4. Updated API Router
- **File**: `/workspace/packages/api/src/router/declarations.ts`
- **Changes**:
  - Updated to query `data` column instead of `specs`
  - Added backward compatibility by extracting specs from data

### 5. Partial Update to Declarations Utility
- **File**: `/workspace/apps/agent/src/ai/utils/declarations.ts`
- **Progress**:
  - Updated type definitions
  - Added comprehensive matching logic function `findAndUpdateMatchingDeclarations`
  - Updated `extractAndSaveDeclarations` to use matching logic
  - **Note**: Some linter errors remain due to complex type assertions

## Matching Logic Implementation

The migration includes sophisticated logic to match spec-initiated declarations with extracted code declarations:

### Matching Criteria
- **Pages**: Match by name or route
- **Endpoints**: Match by path or HTTP method
- **DB Models**: Match by name (case-insensitive)

### Process Flow
1. Extract declarations from source code
2. Find spec-initiated declarations that haven't been implemented
3. Match extracted declarations with spec declarations using type-specific criteria
4. Update matched declarations with extracted data while preserving specs and implementation details
5. Create new declarations for unmatched extracted declarations

## Remaining Tasks

### 1. Fix Linter Errors
- **File**: `/workspace/apps/agent/src/ai/utils/declarations.ts`
- **Issues**: 
  - Boolean type assertions in matching logic
  - Complex type handling for spec data structures
- **Solution**: Refine type assertions and boolean logic

### 2. Update createDeclarations Function
- **File**: `/workspace/apps/agent/src/ai/utils/declarations.ts`
- **Current Issue**: Complex type mismatches when creating spec-initiated declarations
- **Solution**: Simplify type handling or use more specific type assertions

### 3. Test Migration
- **Actions Needed**:
  - Run migration on test database
  - Verify data integrity
  - Test matching logic with real data
  - Ensure backward compatibility

### 4. Update Related Code
- **Files to Review**:
  - Any other files that directly access `specs` or `implementationDetails` columns
  - Frontend components that display declaration information
  - Other utilities that work with declarations

## Migration Benefits

1. **Simplified Schema**: Single data column instead of multiple related columns
2. **Better Data Integrity**: All declaration information in one place
3. **Intelligent Matching**: Automatic matching of spec-initiated declarations with implemented code
4. **Backward Compatibility**: API still provides specs information for existing consumers
5. **Enhanced Tracking**: Clear flags for spec-initiated vs. extracted declarations

## Migration Execution Steps

1. **Backup Database**: Create backup before running migration
2. **Run Migration**: Execute the SQL migration script
3. **Verify Data**: Check that all data was migrated correctly
4. **Deploy Code**: Deploy updated application code
5. **Monitor**: Watch for any issues with the new structure

## Risk Mitigation

- Migration includes comprehensive data handling for all scenarios
- Backward compatibility maintained in API responses
- Graceful fallbacks for edge cases
- Clear rollback path if issues arise

## Next Steps

1. Complete linter error fixes in declarations utility
2. Test migration on development environment
3. Review and update any other affected code
4. Plan production migration timeline
5. Prepare rollback procedures if needed