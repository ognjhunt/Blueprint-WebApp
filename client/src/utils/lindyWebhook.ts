const LINDY_WEBHOOK_URL =
  "https://public.lindy.ai/api/v1/webhooks/lindy/43c7b7d7-bc40-4593-acfe-ba79ad6488b8";
const LINDY_WEBHOOK_AUTH_HEADER =
  "Bearer 1b1338d68dff4f009bbfaee1166cb9fc48b5fefa6dddbea797264674e2ee0150";

export type LindyWebhookPayload = {
  have_we_onboarded: string;
  chosen_time_of_mapping: string;
  chosen_date_of_mapping: string;
  have_user_chosen_date: string;
  address: string;
  company_url: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone_number: string;
  estimated_square_footage: number | null;
  blueprint_id: string;
  chosen_date_of_demo: string;
  chosen_time_of_demo: string;
};

export function triggerLindyWebhook(payload: LindyWebhookPayload) {
  if (typeof fetch !== "function") {
    console.warn("Fetch API unavailable; skipping Lindy webhook trigger.");
    return;
  }

  try {
    fetch(LINDY_WEBHOOK_URL, {
      method: "POST",
      headers: {
        Authorization: LINDY_WEBHOOK_AUTH_HEADER,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(async (resp) => {
        let responseText = "";
        try {
          responseText = await resp.text();
        } catch {
          responseText = "";
        }

        if (!resp.ok) {
          console.error(
            "Lindy webhook failed:",
            responseText || `${resp.status} ${resp.statusText}`,
          );
          return;
        }

        if (!responseText) {
          console.log("Lindy webhook ok: (empty response)");
          return;
        }

        try {
          const parsed = JSON.parse(responseText);
          console.log("Lindy webhook ok:", parsed);
        } catch {
          console.log("Lindy webhook ok:", responseText);
        }
      })
      .catch((err) => console.error("Lindy webhook error:", err));
  } catch (err) {
    console.error("Lindy webhook threw synchronously:", err);
  }
}
