// Dynamic Three.js import to prevent memory crashes
let THREE: any = null;

const getThree = async () => {
  if (!THREE) {
    THREE = await import("three");
  }
  return THREE;
};

export class ThreeScene {
  private scene: any;
  private camera: any;
  private renderer: any | null = null;
  private particles: any | null = null;
  private animationFrameId: number = 0;
  private isInitialized: boolean = false;

  constructor(container: HTMLElement) {
    // Initialize asynchronously to avoid memory crashes
    this.initAsync(container);
  }

  private async initAsync(container: HTMLElement) {
    try {
      console.log("Initializing ThreeScene...");
      
      const THREE = await getThree();
      
      // Scene setup
      this.scene = new THREE.Scene();
    console.log("Scene created successfully");
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;
    console.log("Camera initialized with aspect ratio:", container.clientWidth / container.clientHeight);

    if (typeof window === 'undefined') return;

    try {
      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        powerPreference: "high-performance"
      });
      
      // Set size with proper checks
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(this.renderer.domElement);
      console.log("Renderer initialized successfully with dimensions:", width, "x", height);

    // Create particle system
      const particleGeometry = new THREE.BufferGeometry();
      const particleCount = 1000;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        // Position
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = (Math.random() - 0.5) * 10;
        positions[i + 2] = (Math.random() - 0.5) * 10;

        // Color
        colors[i] = 0.5 + Math.random() * 0.5; // R
        colors[i + 1] = 0.5 + Math.random() * 0.5; // G
        colors[i + 2] = 1.0; // B (more blue tint)
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      this.particles = new THREE.Points(particleGeometry, particleMaterial);
      this.scene.add(this.particles);

      // Start animation
      this.animate();

      // Handle window resize
      window.addEventListener('resize', this.handleResize);
      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize ThreeScene:", error);
      throw error;
    }
  }

  private animate(): void {
    if (!this.isInitialized || !this.renderer || !this.particles) return;
    
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Rotate particles
    this.particles.rotation.x += 0.0003;
    this.particles.rotation.y += 0.0005;

    // Update positions for floating effect
    const positions = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(Date.now() * 0.001 + positions[i] * 0.1) * 0.001;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = (): void => {
    if (!this.isInitialized || !this.renderer) return;

    const container = this.renderer.domElement.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public addMouseInteraction(element: HTMLElement): void {
    if (!this.isInitialized || !this.particles) return;

    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent): void => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

      this.particles!.rotation.x += mouseY * 0.0001;
      this.particles!.rotation.y += mouseX * 0.0001;
    };

    element.addEventListener('mousemove', handleMouseMove);
  }

  public dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.isInitialized = false;
  }
}
