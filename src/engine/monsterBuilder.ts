import * as THREE from 'three';
import { SeaMonsterAlignment, SeaMonsterSize, SeaMonsterSpecies } from '../game/types';

export interface BuiltSeaMonster {
  root: THREE.Group;
  segments: THREE.Object3D[];
  tentacles: THREE.Object3D[];
  tailFin: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  sizeScale: number;
  baseDepthOffset: number;
}

const SIZE_SCALES: Record<SeaMonsterSize, number> = {
  small: 0.72,
  medium: 1.35,
  large: 2.25,
  legendary: 3.35,
};

function getEyeColor(alignment: SeaMonsterAlignment): number {
  if (alignment === 'good') return 0x38bdf8;
  if (alignment === 'evil') return 0xef4444;
  return 0xfbbf24;
}

export function buildSeaMonsterMesh(
  species: SeaMonsterSpecies,
  size: SeaMonsterSize,
  alignment: SeaMonsterAlignment
): BuiltSeaMonster {
  const root = new THREE.Group();
  const s = SIZE_SCALES[size];
  const segments: THREE.Object3D[] = [];
  const tentacles: THREE.Object3D[] = [];
  let tailFin: THREE.Object3D | null = null;
  let jaw: THREE.Object3D | null = null;

  const eyeColor = getEyeColor(alignment);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: eyeColor,
    emissive: eyeColor,
    emissiveIntensity: 1.9,
    roughness: 0.15,
  });

  if (species === 'serpent') {
    const scaleMat = new THREE.MeshStandardMaterial({
      color: alignment === 'good' ? 0x16655f : alignment === 'evil' ? 0x1c3a32 : 0x22514c,
      roughness: 0.42,
      metalness: 0.18,
    });
    const finMat = new THREE.MeshStandardMaterial({
      color: alignment === 'evil' ? 0x991b1b : 0x5eead4,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    // Dragon-like serpent head at bow (-Z)
    const head = new THREE.Group();
    head.position.set(0, 1.35, -3.4);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.4, 8), scaleMat);
    snout.rotation.x = -Math.PI / 2;
    head.add(snout);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15, 6), finMat);
      horn.position.set(side * 0.42, 0.72, 0.45);
      horn.rotation.x = 0.55;
      horn.rotation.z = -side * 0.25;
      head.add(horn);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), eyeMat);
      eye.position.set(side * 0.56, 0.26, -0.3);
      head.add(eye);
    }
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 1.7), scaleMat);
    lowerJaw.position.set(0, -0.35, -0.45);
    head.add(lowerJaw);
    jaw = lowerJaw;
    root.add(head);
    segments.push(head);

    // Undulating spine coils breaking the water
    for (let i = 0; i < 6; i++) {
      const r = Math.max(0.32, 1.0 - i * 0.11);
      const seg = new THREE.Group();
      seg.position.set(0, 0.2, -1.3 + i * 2.0);
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), scaleMat);
      body.scale.set(0.9, 0.9, 1.45);
      seg.add(body);

      const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.95, 4), finMat);
      ridge.position.y = r + 0.35;
      seg.add(ridge);

      root.add(seg);
      segments.push(seg);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 5), finMat);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.3, 10.6);
    root.add(tail);
    tailFin = tail;
  } else if (species === 'kraken') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: alignment === 'evil' ? 0x581c38 : 0x6b2d4a,
      roughness: 0.52,
    });
    const suckerMat = new THREE.MeshStandardMaterial({
      color: 0xd8a8b8,
      roughness: 0.65,
    });

    const mantle = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.ConeGeometry(1.85, 4.4, 12), bodyMat);
    dome.position.set(0, 2.2, 0.4);
    dome.rotation.x = 0.28;
    mantle.add(dome);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), eyeMat);
      eye.position.set(side * 1.12, 0.72, -1.05);
      mantle.add(eye);
    }
    root.add(mantle);
    segments.push(mantle);

    // 8 radial writhing tentacles emerging from the sea
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(angle) * 2.35, -0.2, Math.sin(angle) * 2.35);
      pivot.rotation.y = -angle;

      const armLower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 3.2, 8), bodyMat);
      armLower.position.set(0.45, 1.4, 0);
      armLower.rotation.z = -0.32;
      pivot.add(armLower);

      const armTip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.8, 7), suckerMat);
      armTip.position.set(1.05, 3.5, 0);
      armTip.rotation.z = 0.25;
      pivot.add(armTip);

      root.add(pivot);
      tentacles.push(pivot);
    }
  } else if (species === 'shark') {
    const skinMat = new THREE.MeshStandardMaterial({
      color: alignment === 'evil' ? 0x2b3644 : 0x475569,
      roughness: 0.36,
      metalness: 0.14,
    });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.35, 12, 10), skinMat);
    body.scale.set(0.88, 0.85, 3.4);
    body.position.y = -0.05;
    root.add(body);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.22, 10, 8), bellyMat);
    belly.scale.set(0.8, 0.55, 3.0);
    belly.position.y = -0.45;
    root.add(belly);

    // Iconic tall triangular dorsal fin
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.35, 4), skinMat);
    dorsal.position.set(0, 1.55, 0.1);
    dorsal.rotation.x = 0.22;
    dorsal.scale.set(0.32, 1, 1.15);
    root.add(dorsal);

    // Pectoral fins
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 4), skinMat);
      pec.position.set(side * 1.45, -0.3, -0.5);
      pec.rotation.z = -side * 1.35;
      pec.scale.set(0.45, 1, 0.9);
      root.add(pec);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), eyeMat);
      eye.position.set(side * 0.72, 0.22, -3.2);
      root.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.4, 4), skinMat);
    tail.position.set(0, 0.45, 4.9);
    tail.rotation.x = -0.55;
    tail.scale.set(0.28, 1, 1);
    root.add(tail);
    tailFin = tail;
    segments.push(body);
  } else if (species === 'whale') {
    const whaleMat = new THREE.MeshStandardMaterial({
      color: alignment === 'good' ? 0x1e3a5f : 0x2d3f54,
      roughness: 0.48,
      metalness: 0.08,
    });
    const barnacleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });

    const hull = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 10), whaleMat);
    hull.scale.set(1.05, 0.88, 3.3);
    hull.position.y = 0.1;
    root.add(hull);

    // Pale throat grooves & blowhole
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), barnacleMat);
      b.position.set(i * 0.35, 1.45, -4.1 + Math.abs(i) * 0.35);
      root.add(b);
    }

    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 1.1), whaleMat);
      flipper.position.set(side * 2.5, -0.35, -1.2);
      flipper.rotation.y = side * 0.35;
      flipper.rotation.z = -side * 0.18;
      root.add(flipper);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
      eye.position.set(side * 1.45, 0.35, -4.4);
      root.add(eye);
    }

    const fluke = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 1.4), whaleMat);
    fluke.position.set(0, 0.2, 6.8);
    root.add(fluke);
    tailFin = fluke;
    segments.push(hull);
  } else {
    // deep_horror: Abyssal armored carapace + glowing spines + sweeping claws
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x161224,
      roughness: 0.35,
      metalness: 0.32,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: alignment === 'evil' ? 0xdc2626 : 0x14b8a6,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    });

    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(2.1, 1), chitinMat);
    core.scale.set(1.15, 0.85, 2.2);
    core.position.y = 0.65;
    root.add(core);
    segments.push(core);

    for (let i = 0; i < 5; i++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.1, 5), glowMat);
      spine.position.set(0, 1.95, -2.4 + i * 1.25);
      spine.rotation.x = 0.22;
      root.add(spine);
    }

    for (const side of [-1, 1]) {
      for (let e = 0; e < 2; e++) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), eyeMat);
        eye.position.set(side * (0.9 + e * 0.35), 1.0 + e * 0.2, -3.5 + e * 0.7);
        root.add(eye);
      }

      const claw = new THREE.Group();
      claw.position.set(side * 2.1, 0.2, -1.6);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.6, 7), chitinMat);
      arm.rotation.z = side * 0.9;
      arm.rotation.y = side * 0.4;
      claw.add(arm);
      root.add(claw);
      tentacles.push(claw);
    }
  }

  root.scale.setScalar(s);
  return {
    root,
    segments,
    tentacles,
    tailFin,
    jaw,
    sizeScale: s,
    baseDepthOffset: species === 'shark' || species === 'whale' ? -0.15 : 0.12,
  };
}

export function animateSeaMonsterMesh(
  built: BuiltSeaMonster,
  phase: number,
  attacking: boolean
): void {
  const speedMul = attacking ? 1.85 : 1.0;

  built.segments.forEach((seg, idx) => {
    if (idx === 0) {
      seg.rotation.x = Math.sin(phase * speedMul) * 0.09;
    } else {
      seg.position.y = 0.2 + Math.sin(phase * 1.4 * speedMul - idx * 0.85) * 0.65;
      seg.position.x = Math.cos(phase * 1.1 * speedMul - idx * 0.75) * 0.42;
    }
  });

  built.tentacles.forEach((tent, idx) => {
    const wave = Math.sin(phase * 1.6 * speedMul + idx * 0.9);
    tent.rotation.x = wave * (attacking ? 0.38 : 0.22);
    tent.rotation.z = Math.cos(phase * 1.3 * speedMul + idx) * 0.24;
  });

  if (built.tailFin) {
    built.tailFin.rotation.y = Math.sin(phase * 2.1 * speedMul) * 0.32;
  }

  if (built.jaw) {
    built.jaw.rotation.x = attacking ? 0.35 + Math.sin(phase * 5) * 0.22 : 0.08;
  }
}
