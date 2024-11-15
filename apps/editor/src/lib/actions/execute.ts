"use server";

export async function executeFlow({
  flowUrl,
  testData,
}: {
  flowUrl: string;
  testData: Record<string, unknown>;
}) {
  console.log("[testData]", testData);
  console.log("[flowUrl]", flowUrl);

  const response = await fetch(flowUrl, {
    method: "POST",
    body: JSON.stringify(testData),
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  return data;
}
