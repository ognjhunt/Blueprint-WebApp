import { useEffect, useRef } from "react";
import type { ArtifactExplorerObject } from "@/types/hostedSession";
import { getGLTFLoader, getOrbitControls, getThree } from "@/lib/threeUtils";

interface SiteWorldCanonicalViewerProps {
  objects: ArtifactExplorerObject[];
  selectedObjectId?: string | null;
  className?: string;
}

export function SiteWorldCanonicalViewer({
  objects,
  selectedObjectId,
  className = "",
}: SiteWorldCanonicalViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const objectMapRef = useRef<Map<string, any>>(new Map());
  const selectionRef = useRef<string | null>(selectedObjectId || null);

  useEffect(() => {
    selectionRef.current = selectedObjectId || null;
  }, [selectedObjectId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || objects.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: any = null;

    const init = async () => {
      const THREE = await getThree();
      const OrbitControls = await getOrbitControls();
      const GLTFLoader = await getGLTFLoader();
      if (cancelled || !container) {
        return;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f4efe7");
      scene.fog = new THREE.Fog("#f4efe7", 8, 30);

      const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
      camera.position.set(4.5, 4.5, 6.5);
      cameraRef.current = camera;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0.8, 0);
      controlsRef.current = controls;

      scene.add(new THREE.AmbientLight("#ffffff", 1.2));
      const key = new THREE.DirectionalLight("#fff9e8", 1.6);
      key.position.set(8, 12, 6);
      scene.add(key);

      const fill = new THREE.DirectionalLight("#b6d2ff", 0.6);
      fill.position.set(-5, 4, -8);
      scene.add(fill);

      const grid = new THREE.GridHelper(12, 24, "#9a8f79", "#d9d3c9");
      grid.position.y = 0;
      scene.add(grid);

      const boxMaterial = new THREE.MeshStandardMaterial({
        color: "#e8b15a",
        roughness: 0.65,
        metalness: 0.05,
      });
      const criticalMaterial = new THREE.MeshStandardMaterial({
        color: "#c96e45",
        roughness: 0.58,
        metalness: 0.08,
      });

      const addFallbackBox = (item: ArtifactExplorerObject, colorMaterial: any) => {
        const [cx, cy, cz] = item.center;
        const [ex, ey, ez] = item.extents;
        const geometry = new THREE.BoxGeometry(ex * 2, ey * 2, ez * 2);
        const mesh = new THREE.Mesh(geometry, colorMaterial);
        mesh.position.set(cx, cy, cz);
        return mesh;
      };

      const updateSelection = () => {
        const selectedId = selectionRef.current;
        objectMapRef.current.forEach((entry, objectId) => {
          const active = selectedId === objectId;
          entry.traverse?.((node: any) => {
            if (node.material && "emissive" in node.material) {
              node.material.emissive?.set?.(active ? "#4b89ff" : "#000000");
              node.material.emissiveIntensity = active ? 0.35 : 0;
            }
          });
        });

        if (!selectedId) {
          return;
        }
        const selected = objectMapRef.current.get(selectedId);
        const meta = objects.find((item) => item.id === selectedId);
        if (!selected || !meta) {
          return;
        }
        const [cx, cy, cz] = meta.center;
        controls.target.lerp(new THREE.Vector3(cx, cy, cz), 1);
        camera.position.set(cx + 2.6, cy + 2.1, cz + 2.9);
        controls.update();
      };

      const loader = new GLTFLoader();
      objectMapRef.current.clear();

      await Promise.all(
        objects.map(async (item) => {
          const material = item.taskCritical ? criticalMaterial : boxMaterial;
          const group = new THREE.Group();
          group.name = item.id;
          scene.add(group);
          objectMapRef.current.set(item.id, group);

          const fallback = () => {
            const mesh = addFallbackBox(item, material);
            group.add(mesh);
          };

          if (!item.meshUrl) {
            fallback();
            return;
          }

          await new Promise<void>((resolve) => {
            loader.load(
              item.meshUrl || "",
              (gltf: any) => {
                if (cancelled) {
                  resolve();
                  return;
                }
                const root = gltf.scene || gltf.scenes?.[0];
                if (!root) {
                  fallback();
                  resolve();
                  return;
                }
                const bbox = new THREE.Box3().setFromObject(root);
                const currentCenter = bbox.getCenter(new THREE.Vector3());
                const [cx, cy, cz] = item.center;
                root.position.add(new THREE.Vector3(cx - currentCenter.x, cy - currentCenter.y, cz - currentCenter.z));
                root.traverse((node: any) => {
                  if (node.isMesh) {
                    node.castShadow = false;
                    node.receiveShadow = false;
                  }
                });
                group.add(root);
                resolve();
              },
              undefined,
              () => {
                fallback();
                resolve();
              },
            );
          });
        }),
      );

      const bounds = new THREE.Box3();
      objects.forEach((item) => {
        const [cx, cy, cz] = item.center;
        const [ex, ey, ez] = item.extents;
        bounds.expandByPoint(new THREE.Vector3(cx - ex, cy - ey, cz - ez));
        bounds.expandByPoint(new THREE.Vector3(cx + ex, cy + ey, cz + ez));
      });
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      camera.position.set(center.x + Math.max(size.x, 2.5), center.y + Math.max(size.y, 2.5), center.z + Math.max(size.z, 3));

      const resize = () => {
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      updateSelection();

      const tick = () => {
        if (cancelled) {
          return;
        }
        controls.update();
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(tick);
      };
      tick();
    };

    void init();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      objectMapRef.current.clear();
      controlsRef.current?.dispose?.();
      controlsRef.current = null;
      cameraRef.current = null;
      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
        renderer.domElement?.remove?.();
      }
    };
  }, [objects]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const selectedId = selectedObjectId || null;
    selectionRef.current = selectedId;
    if (!controls || !camera || !selectedId) {
      return;
    }
    const objectMeta = objects.find((item) => item.id === selectedId);
    if (!objectMeta) {
      return;
    }
    const THREEPromise = getThree();
    void THREEPromise.then((THREE) => {
      const [cx, cy, cz] = objectMeta.center;
      controls.target.copy(new THREE.Vector3(cx, cy, cz));
      camera.position.set(cx + 2.4, cy + 1.8, cz + 2.6);
      controls.update();
    });
  }, [objects, selectedObjectId]);

  return <div ref={containerRef} className={`h-[460px] w-full overflow-hidden rounded-[22px] ${className}`} />;
}
