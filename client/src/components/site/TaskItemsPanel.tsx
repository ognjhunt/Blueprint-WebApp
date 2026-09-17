/**
 * The objects the robot has to handle — listed, and photographed.
 *
 * A walkthrough reconstructs the room. It does not reconstruct the tote a robot
 * grasps or the cartons it stacks, and those are frequently filmed clear: a
 * clear work area is the honest thing to record. So this panel asks for the
 * items directly. We suggest what we could read out of the task; the operator
 * corrects the list and adds a few example photos of each, from which the
 * Pipeline builds a sim-ready version and places it back in the scene.
 *
 * The token's scope decides what is offered. Declaring an item is an operating
 * statement, so only an owner link can add, edit, or remove one. Photographing
 * an item is capture, so a film-only link can still add photos — which is the
 * point of handing the filming to someone standing at the workcell.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";

type ItemBasis = "suggested" | "operator_added";
type CoverageStatus = "needs_images" | "covered";
type AssetStatus = "pending" | "proxy" | "sim_ready" | "unsupported";

interface PresentedItem {
  itemId: string;
  label: string;
  locationNote: string | null;
  quantityHint: string | null;
  basis: ItemBasis;
  imageCount: number;
  coverageStatus: CoverageStatus;
  imagesStillWanted: number;
  assetStatus: AssetStatus;
  assetDetail: string | null;
}

interface InventoryResponse {
  items: PresentedItem[];
  allItemsCovered: boolean;
  requestedShots?: string[];
}

/** What the Pipeline is doing with an item's photos, said plainly and secondary. */
function assetNote(item: PresentedItem): string {
  switch (item.assetStatus) {
    case "sim_ready":
      return "Sim-ready ✓";
    case "proxy":
      return "Stand-in built — more photos would sharpen it.";
    case "unsupported":
      return item.assetDetail || "We could not build this one yet; we will follow up.";
    default:
      return "We will build a sim-ready version from your photos.";
  }
}

export function TaskItemsPanel({ token, scope }: { token: string; scope: "owner" | "film" }) {
  const [items, setItems] = useState<PresentedItem[] | null>(null);
  const [requestedShots, setRequestedShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [adding, setAdding] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const apply = (data: InventoryResponse) => {
    setItems(data.items);
    if (Array.isArray(data.requestedShots)) setRequestedShots(data.requestedShots);
  };

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/items`);
      if (!response.ok) {
        setError("We could not load the item list.");
        return;
      }
      apply((await response.json()) as InventoryResponse);
    } catch {
      setError("We could not load the item list.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true);
    setError(null);
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/items`, {
        method: "POST",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ label, locationNote: newLocation.trim() || undefined }),
      });
      if (!response.ok) {
        setError("We could not add that item.");
        return;
      }
      apply((await response.json()) as InventoryResponse);
      setNewLabel("");
      setNewLocation("");
    } catch {
      setError("We could not add that item.");
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    setError(null);
    try {
      const response = await fetch(
        `/api/site-task-brief/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE", credentials: "include", headers: await withCsrfHeader({}) },
      );
      if (!response.ok) {
        setError("We could not remove that item.");
        return;
      }
      apply((await response.json()) as InventoryResponse);
    } catch {
      setError("We could not remove that item.");
    } finally {
      setBusyItem(null);
    }
  }

  async function uploadImages(itemId: string, files: FileList | null) {
    if (!files || !files.length) return;
    setBusyItem(itemId);
    setError(null);
    try {
      let latest: InventoryResponse | null = null;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("image", file);
        const response = await fetch(
          `/api/self-capture/uploads/${encodeURIComponent(token)}/items/${encodeURIComponent(itemId)}/image`,
          { method: "POST", credentials: "include", headers: await withCsrfHeader({}), body: form },
        );
        if (!response.ok) {
          setError("A photo could not be uploaded. Try again.");
          break;
        }
        latest = (await response.json()) as InventoryResponse;
      }
      if (latest) apply(latest);
    } catch {
      setError("A photo could not be uploaded. Try again.");
    } finally {
      setBusyItem(null);
    }
  }

  const shotHint = requestedShots.length
    ? requestedShots.join(", ")
    : "a clear front view, one from the side, and a close-up";

  return (
    <section style={{ marginTop: "28px", borderTop: "1px solid var(--ms-border, #e5e7eb)", paddingTop: "24px" }}>
      <h3 style={{ margin: "0 0 6px" }}>Items in this task</h3>
      <p className="ms-field-hint" style={{ marginBottom: "16px" }}>
        The video shows the work area; a robot also needs the things it handles. If the area was
        clear when you filmed — "there's normally a tote here and boxes there" — add each item and a
        couple of photos of it, and we will build a sim-ready version to place in the scene. Aim for{" "}
        {shotHint}.
      </p>

      {error && (
        <p role="alert" style={{ color: "var(--ms-alert, #b00)", marginBottom: "12px" }}>
          {error}
        </p>
      )}

      {items === null ? (
        <p className="ms-field-hint">Loading the item list…</p>
      ) : items.length === 0 ? (
        <p className="ms-field-hint">
          {scope === "owner"
            ? "No items yet. Add the objects the robot would pick up, move, or handle."
            : "No items have been listed for this task yet."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "14px" }}>
          {items.map((item) => {
            const covered = item.coverageStatus === "covered";
            const busy = busyItem === item.itemId;
            return (
              <li
                key={item.itemId}
                style={{
                  border: "1px solid var(--ms-border, #e5e7eb)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px" }}>
                  <strong>{item.label}</strong>
                  <span
                    className="ms-field-hint"
                    style={{ color: covered ? "var(--ms-ok, #157347)" : "var(--ms-warn, #8a6d00)", whiteSpace: "nowrap" }}
                  >
                    {covered
                      ? `Enough photos ✓ (${item.imageCount})`
                      : item.imageCount > 0
                        ? `${item.imagesStillWanted} more photo${item.imagesStillWanted === 1 ? "" : "s"}`
                        : "Needs photos"}
                  </span>
                </div>

                {item.locationNote && (
                  <p className="ms-field-hint" style={{ margin: "4px 0 0" }}>
                    Where: {item.locationNote}
                  </p>
                )}
                <p className="ms-field-hint" style={{ margin: "4px 0 0", opacity: 0.85 }}>
                  {assetNote(item)}
                </p>

                <div style={{ display: "flex", gap: "14px", marginTop: "10px", flexWrap: "wrap" }}>
                  <input
                    ref={(el) => {
                      fileInputs.current[item.itemId] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    style={{ display: "none" }}
                    onChange={(event) => {
                      void uploadImages(item.itemId, event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="ms-text-link"
                    disabled={busy}
                    onClick={() => fileInputs.current[item.itemId]?.click()}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                  >
                    {busy ? "Uploading…" : "Add photos"}
                  </button>
                  {scope === "owner" && (
                    <button
                      type="button"
                      className="ms-text-link"
                      disabled={busy}
                      onClick={() => void removeItem(item.itemId)}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", color: "var(--ms-alert, #b00)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {scope === "owner" && (
        <form onSubmit={addItem} style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
          <label htmlFor="new-item-label" style={{ display: "grid", gap: "4px" }}>
            <span className="ms-field-hint">Add an item</span>
            <input
              id="new-item-label"
              type="text"
              value={newLabel}
              maxLength={120}
              placeholder="e.g. Cardboard boxes"
              onChange={(event) => setNewLabel(event.target.value)}
            />
          </label>
          <input
            type="text"
            value={newLocation}
            maxLength={400}
            placeholder="Where does it usually sit? (optional)"
            onChange={(event) => setNewLocation(event.target.value)}
          />
          <div>
            <button type="submit" className="ms-button" disabled={adding || !newLabel.trim()}>
              {adding ? "Adding…" : "Add item"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
