import { getEnrichmentManager } from "@/ai/services/enrichment-manager";
import { createRouter } from "@/lib/utils";


const router = createRouter();

// Get enrichment statistics
router.get("/enrichment/stats", async (c) => {
  try {
    const enrichmentManager = getEnrichmentManager();
    const stats = await enrichmentManager.getQueueStats();
    
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Get enrichment status for a specific declaration
router.get("/enrichment/declaration/:declarationId", async (c) => {
  try {
    const declarationId = c.req.param("declarationId");
    const enrichmentManager = getEnrichmentManager();
    
    const status = await enrichmentManager.getEnrichmentStatus(declarationId);
    
    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Get job status
router.get("/enrichment/job/:jobId", async (c) => {
  try {
    const jobId = c.req.param("jobId");
    const enrichmentManager = getEnrichmentManager();
    
    const status = await enrichmentManager.getJobStatus(jobId);
    
    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// Force enrichment of a declaration (for testing/debugging)
router.post("/enrichment/force/:declarationId", async (c) => {
  try {
    const declarationId = c.req.param("declarationId");
    const workflowContext = c.get("workflowContext");
    
    // This is a simplified endpoint - in a real implementation you'd need to
    // fetch the declaration data and source code from the database
    return c.json(
      {
        success: false,
        error: "Force enrichment endpoint not fully implemented - use for testing only",
      },
      501
    );
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export { router as enrichmentRouter };