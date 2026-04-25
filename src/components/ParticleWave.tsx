import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ParticleWave() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene
    const scene = new THREE.Scene();
    
    // Add fog to fade out particles as they rotate to the back of the sphere
    // Since the background is white, fog color should be white
    scene.fog = new THREE.Fog(0xffffff, 4, 9);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;
    camera.position.x = -1.8; // Offset camera so the sphere stays visually on the right

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    const updateSize = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    containerRef.current.appendChild(renderer.domElement);
    
    // Initial size
    updateSize();

    // 4. Geometry & Particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000; // Reduced for a cleaner, organized look

    const posArray = new Float32Array(particlesCount * 3);
    const colorsArray = new Float32Array(particlesCount * 3);

    // Official Google-like colors from your reference
    const colorBlue = new THREE.Color(0x4285f4); 
    const colorPurple = new THREE.Color(0x9b72cb);
    const colorRed = new THREE.Color(0xea4335);

    // Distribute evenly on a hollow sphere using Fibonacci mapping
    const radius = 3.5;
    for (let i = 0; i < particlesCount; i++) {
        const y = 1 - (i / (particlesCount - 1)) * 2;
        const r = Math.sqrt(1 - y * y) * radius;
        const theta = Math.PI * (3 - Math.sqrt(5)) * i;

        const px = Math.cos(theta) * r;
        const py = y * radius;
        const pz = Math.sin(theta) * r;

        const idx = i * 3;
        posArray[idx]     = px;
        posArray[idx + 1] = py;
        posArray[idx + 2] = pz;

        // Gradient color scaling from X axis (Blue -> Purple -> Red)
        const xPercent = (px + radius) / (radius * 2); // Normalized 0 to 1
        const mixedColor = new THREE.Color();
        
        if (xPercent < 0.5) {
            mixedColor.lerpColors(colorBlue, colorPurple, xPercent * 2);
        } else {
            mixedColor.lerpColors(colorPurple, colorRed, (xPercent - 0.5) * 2);
        }

        colorsArray[idx]     = mixedColor.r;
        colorsArray[idx + 1] = mixedColor.g;
        colorsArray[idx + 2] = mixedColor.b;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    // Custom circle texture for the points
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.beginPath();
        ctx.arc(16, 16, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF';
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
        size: 0.05,
        map: texture,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false, // CRITICAL: Fixes weird artifacts/clipping between points
        blending: THREE.NormalBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, material);
    scene.add(particlesMesh);

    // 5. Mouse Parallax Setup
    let mouseX = 0;
    let mouseY = 0;

    const onMouseMove = (event: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // Calculate mouse position relative to the container center
        const x = event.clientX - rect.left - (rect.width / 2);
        const y = event.clientY - rect.top - (rect.height / 2);
        
        // Normalize between -1 and 1
        mouseX = (x / (rect.width / 2));
        mouseY = -(y / (rect.height / 2));
    };
    window.addEventListener('mousemove', onMouseMove);

    // 6. Animation
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const baseCameraX = 0; 

    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // Slow, elegant rotation
        particlesMesh.rotation.y = elapsedTime * 0.08;
        particlesMesh.rotation.x = -0.15; 

        // Apply mouse position to camera with easing (smooth parallax)
        const targetX = baseCameraX + mouseX * 0.3;
        const targetY = mouseY * 0.3;
        
        camera.position.x += (targetX - camera.position.x) * 0.05;
        camera.position.y += (targetY - camera.position.y) * 0.05;
        
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();

    // 7. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
        updateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
        window.removeEventListener('mousemove', onMouseMove);
        resizeObserver.disconnect();
        cancelAnimationFrame(animationFrameId);
        if (containerRef.current?.contains(renderer.domElement)) {
            containerRef.current.removeChild(renderer.domElement);
        }
        particlesGeometry.dispose();
        material.dispose();
        texture.dispose();
        renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="absolute top-1/2 right-[-5vw] -translate-y-1/2 w-[600px] h-[600px] pointer-events-none z-0" 
      style={{ maxWidth: '80vw', maxHeight: '80vw' }}
    />
  );
}
