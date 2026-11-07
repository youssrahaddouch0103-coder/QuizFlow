import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import './Hero3D.css'

/**
 * Fond 3D de la page d'accueil : un grand « Q » et des cubes A, B, C, D qui flottent
 * et suivent légèrement la souris. Chargé à part (lazy) pour ne pas alourdir le reste du site.
 */

const CHOICE_COLORS = ['#2f5d9e', '#5e7f2e', '#8c3b4f', '#7a5a10']

function letterTexture(letter: string, color: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 170px "Bricolage Grotesque", "Instrument Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, 128, 140)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

type Vec = [number, number, number]
type Layout = {
  lookAt: Vec
  q: Vec
  cubes: [number, number, number, number][]
  beads: [number, number, number, number, number][]
  narrowZ: number
}

/** Placement des objets : « hero » pour la page d'accueil, « panel » pour le panneau de connexion. */
const LAYOUTS: Record<'hero' | 'panel' | 'full', Layout> = {
  hero: {
    lookAt: [1.5, 0, 0],
    q: [8.4, 3.2, -3],
    cubes: [
      [2.3, 3.5, -2, 0.85],
      [9.2, -2.6, -1.5, 1.05],
      [5.4, -3.7, -1, 0.8],
      [0.4, -3.9, -3, 0.75],
    ],
    beads: [
      [3.2, 3.4, -1, 0.22, 0],
      [8.6, 2.6, -5, 0.35, 1],
      [-3.6, 1.2, -6, 0.3, 2],
      [6.4, -3.6, -3, 0.18, 0],
      [0.6, -1.4, -7, 0.4, 2],
      [-7.8, 2.8, -6, 0.28, 1],
    ],
    narrowZ: 17,
  },
  panel: {
    lookAt: [0, 0, 0],
    q: [3.1, 3.6, -3.5],
    cubes: [
      [3.4, -0.4, -2.5, 0.75],
      [-3.3, -4.1, -2, 0.85],
      [2.7, -4.3, -1.5, 0.7],
      [-3.6, 2.4, -5, 0.6],
    ],
    beads: [
      [1.2, 4.4, -2, 0.2, 0],
      [-2.4, 0.4, -6, 0.3, 2],
      [3.8, 1.6, -5, 0.26, 1],
      [-0.6, -4.6, -3, 0.22, 0],
      [4.2, -2.6, -6, 0.32, 2],
    ],
    narrowZ: 13,
  },
  full: {
    lookAt: [0, 0, 0],
    q: [6.6, 2.9, -3],
    cubes: [
      [-6.4, 2.6, -2, 0.9],
      [7.0, -2.8, -1.5, 1],
      [-5.4, -3.3, -1, 0.8],
      [2.6, 4.4, -5, 0.6],
    ],
    beads: [
      [-3.2, 4.0, -3, 0.22, 0],
      [9.4, 0.6, -6, 0.35, 1],
      [-9.0, -0.6, -6, 0.3, 2],
      [3.6, -4.4, -2, 0.2, 0],
      [-1.4, -4.8, -6, 0.38, 2],
      [-8.4, 4.2, -7, 0.28, 1],
    ],
    narrowZ: 19,
  },
}

type Floater = { obj: THREE.Object3D; base: THREE.Vector3; orig: THREE.Vector3; speed: number; phase: number; spin: THREE.Vector3; amp: number }

export default function Hero3D({ variant = 'hero' }: { variant?: 'hero' | 'panel' | 'full' }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const L = LAYOUTS[variant]

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      return // pas de WebGL : on garde le fond CSS
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const fog = new THREE.Fog('#1b2a4a', 9, 22)
    scene.fog = fog
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0, 12)

    // Lumières : une douce lumière ambiante, une clé blanche, un reflet pistache.
    scene.add(new THREE.HemisphereLight('#dfe7f5', '#0d162a', 1.1))
    const key = new THREE.DirectionalLight('#ffffff', 2.2)
    key.position.set(-4, 6, 8)
    scene.add(key)
    const glow = new THREE.PointLight('#b5d38a', 40, 18, 1.6)
    glow.position.set(5, 3, 4)
    scene.add(glow)

    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)
    const floaters: Floater[] = []
    const add = (obj: THREE.Object3D, x: number, y: number, z: number, amp = 0.25) => {
      obj.position.set(x, y, z)
      scene.add(obj)
      floaters.push({
        obj,
        base: new THREE.Vector3(x, y, z),
        orig: new THREE.Vector3(x, y, z),
        speed: 0.35 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.15),
        amp,
      })
    }

    // Le grand « Q » : un anneau bleu et une queue pistache.
    const q = new THREE.Group()
    const ringMat = track(new THREE.MeshStandardMaterial({ color: '#3b5f9e', roughness: 0.28, metalness: 0.35 }))
    const ring = new THREE.Mesh(track(new THREE.TorusGeometry(1.5, 0.42, 40, 120)), ringMat)
    q.add(ring)
    const tailMat = track(new THREE.MeshStandardMaterial({ color: '#b5d38a', roughness: 0.3, metalness: 0.15, emissive: '#3c5222', emissiveIntensity: 0.35 }))
    const tail = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.34, 1.1, 8, 24)), tailMat)
    tail.position.set(1.25, -1.25, 0.15)
    tail.rotation.z = Math.PI / 4
    q.add(tail)
    q.rotation.set(0.35, -0.5, 0.1)
    add(q, L.q[0], L.q[1], L.q[2], 0.3)

    // Les cubes de réponses A, B, C, D.
    const cubeGeo = track(new RoundedBoxGeometry(1, 1, 1, 5, 0.18))
    const faceGeo = track(new THREE.PlaneGeometry(0.78, 0.78))
    const cubeSpots = L.cubes
    ;['A', 'B', 'C', 'D'].forEach((letter, i) => {
      const color = CHOICE_COLORS[i]
      const cube = new THREE.Group()
      cube.add(new THREE.Mesh(cubeGeo, track(new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 }))))
      const tex = track(letterTexture(letter, color))
      const face = new THREE.Mesh(faceGeo, track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 })))
      face.position.z = 0.505
      cube.add(face)
      const [x, y, z, s] = cubeSpots[i]
      cube.scale.setScalar(s)
      cube.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * 0.8 - 0.4, Math.random() * 0.4 - 0.2)
      add(cube, x, y, z)
    })

    // Petites perles pour la profondeur.
    const beadGeo = track(new THREE.SphereGeometry(1, 24, 24))
    const beadMats = [
      track(new THREE.MeshStandardMaterial({ color: '#b5d38a', roughness: 0.3 })),
      track(new THREE.MeshStandardMaterial({ color: '#dfe7f5', roughness: 0.25, metalness: 0.2 })),
      track(new THREE.MeshStandardMaterial({ color: '#2a3d66', roughness: 0.5 })),
    ]
    L.beads.forEach(([x, y, z, r, m]) => {
      const b = new THREE.Mesh(beadGeo, beadMats[m])
      b.scale.setScalar(r)
      add(b, x, y, z, 0.4)
    })

    // Taille, souris, visibilité.
    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // Sur écran étroit on recule la caméra pour garder le Q visible.
      camera.position.z = w < 700 ? L.narrowZ : 12
      // Le brouillard suit la distance de la caméra, pour que les objets restent visibles.
      fog.near = camera.position.z - 3
      fog.far = camera.position.z + 10
      // Écran en hauteur (téléphone) : on rapproche les objets au-dessus et au-dessous de la carte.
      const portrait = variant === 'full' && w / h < 0.8
      for (const f of floaters) f.base.set(portrait ? f.orig.x * 0.42 : f.orig.x, portrait ? f.orig.y * 1.55 : f.orig.y, f.orig.z)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const pointer = new THREE.Vector2(0, 0)
    const onMove = (e: PointerEvent) => {
      pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let visible = true
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    io.observe(host)

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const clock = new THREE.Clock()
    let frame = 0

    const render = () => {
      const t = clock.getElapsedTime()
      for (const f of floaters) {
        f.obj.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * f.amp
        f.obj.position.x = f.base.x + Math.cos(t * f.speed * 0.7 + f.phase) * f.amp * 0.5
        f.obj.rotation.x += f.spin.x * 0.01
        f.obj.rotation.y += f.spin.y * 0.01
        f.obj.rotation.z += f.spin.z * 0.01
      }
      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04
      camera.position.y += (-pointer.y * 0.6 - camera.position.y) * 0.04
      camera.lookAt(...L.lookAt)
      renderer.render(scene, camera)
    }

    const loop = () => {
      frame = requestAnimationFrame(loop)
      if (visible && !document.hidden) render()
    }

    if (reduce) {
      camera.lookAt(...L.lookAt)
      renderer.render(scene, camera)
    } else {
      loop()
    }
    host.classList.add('is-ready')

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      ro.disconnect()
      io.disconnect()
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [variant])

  return <div ref={hostRef} className="hero3d" aria-hidden="true" />
}
