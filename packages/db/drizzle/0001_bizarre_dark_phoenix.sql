-- Step 1: Merge specs and implementation_details into data column
UPDATE "declarations" 
SET "data" = CASE 
  -- For declarations that have both data and specs (spec-initiated and later implemented)
  WHEN "data" IS NOT NULL AND "specs" IS NOT NULL THEN 
    jsonb_set(
      jsonb_set(
        jsonb_set(
          "data",
          '{specs}',
          "specs"
        ),
        '{implementationDetails}',
        COALESCE("implementation_details", 'null'::jsonb)
      ),
      '{isSpecInitiated}',
      'true'::jsonb
    ) || jsonb_set(
      "data",
      '{isImplemented}',
      'true'::jsonb
    )
  
  -- For declarations that only have specs (spec-initiated but not implemented)
  WHEN "data" IS NULL AND "specs" IS NOT NULL THEN
    jsonb_build_object(
      'name', COALESCE("specs"->>'name', "specs"->'data'->>'name', 'Unknown'),
      'type', COALESCE("specs"->'data'->>'type', 'unknown'),
      'isExported', true,
      'dependencies', '[]'::jsonb,
      'uri', COALESCE("uri", ''),
      'specs', "specs",
      'implementationDetails', COALESCE("implementation_details", 'null'::jsonb),
      'isSpecInitiated', true,
      'isImplemented', false
    )
  
  -- For declarations that only have data (extracted declarations)
  WHEN "data" IS NOT NULL AND "specs" IS NULL THEN
    jsonb_set(
      jsonb_set(
        "data",
        '{isSpecInitiated}',
        'false'::jsonb
      ),
      '{isImplemented}',
      'true'::jsonb
    )
  
  -- For declarations that have neither (shouldn't happen but handle gracefully)
  ELSE 
    jsonb_build_object(
      'name', 'Unknown',
      'type', 'unknown',
      'isExported', false,
      'dependencies', '[]'::jsonb,
      'uri', COALESCE("uri", ''),
      'isSpecInitiated', false,
      'isImplemented', false
    )
END
WHERE "data" IS NULL OR "specs" IS NOT NULL OR "implementation_details" IS NOT NULL;

-- Step 2: Drop the old columns
ALTER TABLE "declarations" DROP COLUMN "specs";--> statement-breakpoint
ALTER TABLE "declarations" DROP COLUMN "implementation_details";