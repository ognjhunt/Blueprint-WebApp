import { useEffect, useRef, useState } from "react";

export function TaskThumbnailEditor({ existing, onChange }: { existing: string | null; onChange: (png: string | null) => void }) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1), [x, setX] = useState(50), [y, setY] = useState(50);
  const [preview, setPreview] = useState(existing);
  const [error, setError] = useState("");
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => { setPreview(existing); }, [existing]);
  useEffect(() => {
    if (!source) return;
    const canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 300;
    const context = canvas.getContext("2d"); if (!context) return;
    const scale = Math.max(480 / source.naturalWidth, 300 / source.naturalHeight) * zoom;
    const width = source.naturalWidth * scale, height = source.naturalHeight * scale;
    context.fillStyle = "#e9eade"; context.fillRect(0, 0, 480, 300);
    context.drawImage(source, -(width - 480) * x / 100, -(height - 300) * y / 100, width, height);
    const png = canvas.toDataURL("image/png").split(",")[1];
    setPreview(png); onChangeRef.current(png);
  }, [source, zoom, x, y]);
  async function choose(file?: File) {
    if (!file) return;
    const current = ++request.current;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15_000_000) {
      setError("Choose a JPG, PNG or WebP photo under 15 MB."); return;
    }
    setError("");
    const url = URL.createObjectURL(file), image = new Image();
    try {
      image.src = url; await image.decode();
      if (current !== request.current) return;
      if (image.naturalWidth * image.naturalHeight > 25_000_000) throw new Error();
      setZoom(1); setX(50); setY(50); setSource(image);
    } catch { setError("This photo could not be opened. Try a smaller JPG or PNG."); }
    finally { URL.revokeObjectURL(url); }
  }
  return <div className="ms-thumbnail-editor">
    <label>Task thumbnail (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void choose(event.target.files?.[0])} /></label>
    <p className="ms-field-hint">Show the objects and work surface. Crop out faces, logos, signs, shipping labels and distinctive surroundings. Only this preview is uploaded; image metadata is removed.</p>
    {preview && <img src={`data:image/png;base64,${preview}`} width={480} height={300} alt="Thumbnail crop to approve for public display" />}
    {source && <details><summary>Adjust crop</summary>
      <label>Zoom<input type="range" min="1" max="4" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <label>Horizontal position<input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))} /></label>
      <label>Vertical position<input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))} /></label>
    </details>}
    {preview && <button type="button" className="ms-text-link" onClick={() => { request.current++; setSource(null); setPreview(null); onChange(null); }}>Use a task illustration instead</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
