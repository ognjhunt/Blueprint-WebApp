export type PostSignupWorkflowPayload = {
  blueprintId: string;
  userId?: string;
  companyName: string;
  address: string;
  companyUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  locationType?: string;
  squareFootage?: number | null;
  onboardingGoal?: string;
  audienceType?: string;
};

const POST_SIGNUP_ENDPOINT = "/api/post-signup-workflows";

function buildPayload(body: PostSignupWorkflowPayload) {
  const payload: Record<string, unknown> = { ...body };

  // Remove undefined values so we don't send noisy keys to the server
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return payload;
}

export async function triggerPostSignupWorkflows(
  body: PostSignupWorkflowPayload,
) {
  if (typeof fetch !== "function") {
    console.warn("Fetch API unavailable; skipping post-signup workflow trigger.");
    return;
  }

  try {
    const response = await fetch(POST_SIGNUP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(body)),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error(
        "Post-signup workflow trigger failed:",
        message || `${response.status} ${response.statusText}`,
      );
      return;
    }

    // We don't currently surface the response to the UI, but logging helps debugging
    const data = await response.json().catch(() => null);
    if (data) {
      console.info("Post-signup workflows queued:", data);
    }
  } catch (error) {
    console.error("Post-signup workflow request error:", error);
  }
}

export function triggerPostSignupWorkflowsDetached(
  payload: PostSignupWorkflowPayload,
) {
  void triggerPostSignupWorkflows(payload);
}
