import express from "express";
import ivm from "isolated-vm";

const router = express.Router();

router.get("/", (_req, res) => {
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = isolate.createContextSync();
  const global = context.global;

  global.setSync("global", global.derefInto());

  // Load a function into the VM that returns an object
  const script = isolate.compileScriptSync(
    "function returnObject() { return { x: 10, y: 20 }; }",
  );

  script.runSync(context);

  // Reference to the function within the VM
  const fnReference = context.global.getSync("returnObject", {
    reference: true,
  });

  // Apply the function within the context and transfer the result
  const result = fnReference.applySync(null, [], {
    result: { copy: true },
    arguments: { copy: true },
  });

  res.json({ result });
});

export default router;
