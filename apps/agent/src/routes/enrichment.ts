import { getEnrichmentStats, getJobStatus, getSemanticData } from "@/ai/services/semantic-enrichment";
import { createRouter } from "@/lib/utils";

const router = createRouter();

// Get enrichment statistics
router.get("/enrichment/stats", async (c) => {
  try {
    const stats = await getEnrichmentStats();
    
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
    
    if (!declarationId) {
      return c.json(
        {
          success: false,
          error: "Declaration ID is required",
        },
        400
      );
    }

    const semanticData = await getSemanticData(declarationId);
    
    return c.json({
      success: true,
      data: {
        declarationId,
        enriched: semanticData !== null,
        semanticData,
      },
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

// Get job status by job ID
router.get("/enrichment/job/:jobId", async (c) => {
  try {
    const jobId = c.req.param("jobId");
    
    if (!jobId) {
      return c.json(
        {
          success: false,
          error: "Job ID is required",
        },
        400
      );
    }

    const jobStatus = await getJobStatus(jobId);
    
    return c.json({
      success: true,
      data: jobStatus,
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

export default router;