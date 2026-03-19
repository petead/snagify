/**
 * Regenerates the inspection PDF via POST /api/generate-pdf and triggers a browser download
 * of the response blob — same flow as the purple "Download PDF" on the report page.
 */
export async function regenerateAndDownloadInspectionPdf(inspectionId: string): Promise<void> {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionId }),
  });

  if (!response.ok) {
    let errMsg = "Failed to generate PDF";
    try {
      const errData = (await response.json()) as { error?: string };
      errMsg = errData.error ?? errMsg;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("PDF is empty — please try again");
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Snagify_Report_${inspectionId}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}
