import * as THREE from 'three';
import {
  SeaMonsterAlignment,
  SeaMonsterAttackStyle,
  SeaMonsterSize,
  SeaMonsterSpecies,
} from '../game/types';

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

function addJawTeeth(
  jawGroup: THREE.Group,
  toothMat: THREE.Material,
  count: number,
  width: number,
  zStart: number,
  zEnd: number,
  yOffset: number,
  pointUp: boolean
): void {
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const zPos = zStart + (zEnd - zStart) * t;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 4), toothMat);
      tooth.position.set(side * width * (1 - t * 0.35), yOffset, zPos);
      if (!pointUp) tooth.rotation.x = Math.PI;
      jawGroup.add(tooth);
    }
  }
}

export function buildSeaMonsterMesh(
  species: SeaMonsterSpecies,
  size: SeaMonsterSize,
  alignment: SeaMonsterAlignment
): BuiltSeaMonster {
  const root = new THREE.Group();
  const s = SIZE_SCALES[size] * (species === 'giant_kraken' ? 1.36 : 1.0);
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
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0xf4efe6,
    roughness: 0.32,
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

    const head = new THREE.Group();
    head.position.set(0, 1.35, -3.4);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.5, 8), scaleMat);
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

    const lowerJaw = new THREE.Group();
    lowerJaw.position.set(0, -0.25, 0.1);
    const jawBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 1.85), scaleMat);
    jawBar.position.set(0, -0.1, -0.85);
    lowerJaw.add(jawBar);
    addJawTeeth(lowerJaw, toothMat, 4, 0.36, -0.3, -1.6, 0.14, true);
    head.add(lowerJaw);
    jaw = lowerJaw;
    root.add(head);
    segments.push(head);

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
  } else if (species === 'kraken' || species === 'giant_kraken') {
    const isGiant = species === 'giant_kraken';
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isGiant ? 0x35103a : alignment === 'evil' ? 0x581c38 : 0x6b2d4a,
      roughness: 0.48,
      metalness: isGiant ? 0.18 : 0.08,
    });
    const suckerMat = new THREE.MeshStandardMaterial({
      color: isGiant ? 0xe5b78e : 0xd8a8b8,
      roughness: 0.62,
    });

    const mantle = new THREE.Group();
    const dome = new THREE.Mesh(
      new THREE.ConeGeometry(isGiant ? 2.4 : 1.85, isGiant ? 5.6 : 4.4, 12),
      bodyMat
    );
    dome.position.set(0, isGiant ? 2.7 : 2.2, 0.4);
    dome.rotation.x = 0.28;
    mantle.add(dome);

    if (isGiant) {
      const crownFin = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.1, 6), suckerMat);
      crownFin.position.set(0, 4.9, 0.9);
      crownFin.rotation.x = 0.35;
      crownFin.scale.set(1.4, 1, 0.35);
      mantle.add(crownFin);
    }

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(isGiant ? 0.38 : 0.28, 10, 10), eyeMat);
      eye.position.set(side * (isGiant ? 1.45 : 1.12), isGiant ? 0.92 : 0.72, -1.15);
      mantle.add(eye);
    }
    root.add(mantle);
    segments.push(mantle);

    const armCount = isGiant ? 10 : 8;
    const armRadius = isGiant ? 3.25 : 2.35;
    for (let i = 0; i < armCount; i++) {
      const angle = (i / armCount) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(angle) * armRadius, -0.2, Math.sin(angle) * armRadius);
      pivot.rotation.y = -angle;

      const lowerH = isGiant ? 4.8 : 3.2;
      const armLower = new THREE.Mesh(
        new THREE.CylinderGeometry(isGiant ? 0.44 : 0.32, isGiant ? 0.68 : 0.5, lowerH, 8),
        bodyMat
      );
      armLower.position.set(isGiant ? 0.68 : 0.45, lowerH * 0.45, 0);
      armLower.rotation.z = -0.34;
      pivot.add(armLower);

      const tipH = isGiant ? 4.4 : 2.8;
      const armTip = new THREE.Mesh(
        new THREE.ConeGeometry(isGiant ? 0.42 : 0.32, tipH, 7),
        suckerMat
      );
      armTip.position.set(isGiant ? 1.75 : 1.05, lowerH + tipH * 0.25, 0);
      armTip.rotation.z = 0.28;
      pivot.add(armTip);

      root.add(pivot);
      tentacles.push(pivot);
    }
  } else if (species === 'leviathan_squid') {
    const squidMat = new THREE.MeshStandardMaterial({
      color: 0x861f24,
      roughness: 0.4,
      metalness: 0.14,
    });
    const finMat = new THREE.MeshStandardMaterial({
      color: 0xc2494d,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    const mantle = new THREE.Group();
    const torpedo = new THREE.Mesh(new THREE.ConeGeometry(1.35, 5.4, 10), squidMat);
    torpedo.rotation.x = Math.PI * 0.42;
    torpedo.position.set(0, 1.1, 1.9);
    mantle.add(torpedo);

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.2, 3), finMat);
      fin.position.set(side * 1.15, 1.7, 3.7);
      fin.rotation.z = -side * Math.PI * 0.42;
      fin.rotation.x = Math.PI * 0.3;
      mantle.add(fin);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 9), eyeMat);
      eye.position.set(side * 0.85, 0.55, -0.75);
      mantle.add(eye);
    }
    root.add(mantle);
    segments.push(mantle);

    // 6 grasping arms + 2 long forward whip-tentacles
    for (let i = 0; i < 8; i++) {
      const isWhip = i === 0 || i === 4;
      const spread = (i - 3.5) * 0.35;
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(spread) * 1.1, 0.15 + (i % 2) * 0.35, -1.1);
      pivot.rotation.y = spread;

      const len = isWhip ? 5.8 : 3.2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, len, 7), squidMat);
      arm.rotation.x = -Math.PI * 0.46;
      arm.position.set(0, 0.15, -len * 0.48);
      pivot.add(arm);

      if (isWhip) {
        const club = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.35, 6), finMat);
        club.rotation.x = -Math.PI * 0.46;
        club.position.set(0, 0.25, -len - 0.35);
        pivot.add(club);
      }

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

    // Hinged shark lower jaw + teeth
    const sharkJaw = new THREE.Group();
    sharkJaw.position.set(0, -0.35, -2.9);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 1.55), bellyMat);
    jawMesh.position.set(0, -0.1, -0.65);
    sharkJaw.add(jawMesh);
    addJawTeeth(sharkJaw, toothMat, 4, 0.46, -0.2, -1.35, 0.14, true);
    root.add(sharkJaw);
    jaw = sharkJaw;

    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.35, 4), skinMat);
    dorsal.position.set(0, 1.55, 0.1);
    dorsal.rotation.x = 0.22;
    dorsal.scale.set(0.32, 1, 1.15);
    root.add(dorsal);

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

    // Hinged lower whale jaw
    const whaleJaw = new THREE.Group();
    whaleJaw.position.set(0, -0.4, -4.4);
    const jawBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.48, 2.3), barnacleMat);
    jawBody.position.set(0, -0.15, -1.05);
    whaleJaw.add(jawBody);
    root.add(whaleJaw);
    jaw = whaleJaw;

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
  } else if (species === 'mosasaur') {
    const scaleMat = new THREE.MeshStandardMaterial({ color: 0x1e4c5c, roughness: 0.45, metalness: 0.2 });
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 12, 9), scaleMat);
    body.scale.set(0.95, 0.72, 3.2);
    body.position.y = 0.05;
    root.add(body);
    segments.push(body);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 2.8), scaleMat);
    snout.position.set(0, 0.55, -4.2);
    root.add(snout);

    const lowerJaw = new THREE.Group();
    lowerJaw.position.set(0, 0.1, -3.1);
    const jBox = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.34, 2.6), scaleMat);
    jBox.position.set(0, -0.1, -1.25);
    lowerJaw.add(jBox);
    addJawTeeth(lowerJaw, toothMat, 5, 0.48, -0.25, -2.4, 0.16, true);
    root.add(lowerJaw);
    jaw = lowerJaw;

    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 4), crestMat);
      sp.position.set(0, 1.2 - i * 0.06, -2.0 + i * 1.05);
      root.add(sp);
    }

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), eyeMat);
      eye.position.set(side * 0.68, 0.72, -3.7);
      root.add(eye);

      const paddleF = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.85), scaleMat);
      paddleF.position.set(side * 1.75, -0.15, -1.5);
      paddleF.rotation.y = side * 0.35;
      root.add(paddleF);

      const paddleR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.68), scaleMat);
      paddleR.position.set(side * 1.4, -0.2, 2.2);
      paddleR.rotation.y = side * 0.45;
      root.add(paddleR);
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 5), crestMat);
    tail.rotation.x = Math.PI * 0.48;
    tail.scale.set(0.28, 1, 1);
    tail.position.set(0, 0.35, 5.4);
    root.add(tail);
    tailFin = tail;
  } else if (species === 'frost_leviathan') {
    const hideMat = new THREE.MeshStandardMaterial({ color: 0x3b586e, roughness: 0.56, metalness: 0.15 });
    const iceMat = new THREE.MeshStandardMaterial({ color: 0xcbeafe, roughness: 0.25, metalness: 0.12 });

    const trunk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.95, 1), hideMat);
    trunk.scale.set(1.05, 0.82, 2.65);
    trunk.position.y = 0.3;
    root.add(trunk);
    segments.push(trunk);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 2.4), hideMat);
    skull.position.set(0, 0.72, -3.9);
    root.add(skull);

    const lowerJaw = new THREE.Group();
    lowerJaw.position.set(0, 0.12, -3.1);
    const jMesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 2.15), hideMat);
    jMesh.position.set(0, -0.15, -0.95);
    lowerJaw.add(jMesh);
    addJawTeeth(lowerJaw, toothMat, 4, 0.62, -0.25, -1.85, 0.16, true);
    root.add(lowerJaw);
    jaw = lowerJaw;

    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.85, 6), toothMat);
      tusk.rotation.x = -Math.PI * 0.42;
      tusk.rotation.z = -side * 0.18;
      tusk.position.set(side * 0.82, 0.45, -5.3);
      root.add(tusk);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), eyeMat);
      eye.position.set(side * 0.92, 0.9, -4.1);
      root.add(eye);
    }

    for (let i = 0; i < 5; i++) {
      const plate = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.25, 5), iceMat);
      plate.position.set(0, 1.78, -2.0 + i * 1.25);
      plate.rotation.x = 0.22;
      root.add(plate);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.26, 1.25), hideMat);
    tail.position.set(0, 0.25, 5.4);
    root.add(tail);
    tailFin = tail;
  } else {
    // deep_horror: Abyssal armored carapace + glowing spines + articulated jaw
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

    const horrorJaw = new THREE.Group();
    horrorJaw.position.set(0, 0.05, -3.1);
    const jPlate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 1.9), chitinMat);
    jPlate.position.set(0, -0.1, -0.85);
    horrorJaw.add(jPlate);
    addJawTeeth(horrorJaw, toothMat, 4, 0.58, -0.2, -1.65, 0.16, true);
    root.add(horrorJaw);
    jaw = horrorJaw;

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
  attacking: boolean,
  attackAnimProgress = 0,
  attackStyle: SeaMonsterAttackStyle = 'ram_bite',
  defeated = false
): void {
  if (defeated) {
    built.root.rotation.z = 0.58;
    if (built.jaw) built.jaw.rotation.x = 0.18;
    built.tentacles.forEach((tent, idx) => {
      tent.rotation.x = 0.12 + Math.sin(phase * 0.3 + idx) * 0.05;
      tent.rotation.z = 0.25;
    });
    return;
  }

  built.root.rotation.z = 0;
  const speedMul = attacking ? 1.85 : 1.0;

  built.segments.forEach((seg, idx) => {
    if (idx === 0) {
      seg.rotation.x = Math.sin(phase * speedMul) * 0.09;
    } else {
      seg.position.y = 0.2 + Math.sin(phase * 1.4 * speedMul - idx * 0.85) * 0.65;
      seg.position.x = Math.cos(phase * 1.1 * speedMul - idx * 0.75) * 0.42;
    }
  });

  const lashPulse = attackStyle === 'tentacles' && attackAnimProgress > 0
    ? Math.sin(attackAnimProgress * Math.PI)
    : 0;

  built.tentacles.forEach((tent, idx) => {
    const wave = Math.sin(phase * 1.6 * speedMul + idx * 0.9);
    const slamReach = lashPulse * (0.95 + (idx % 2) * 0.3);
    tent.rotation.x = wave * (attacking ? 0.38 : 0.22) - slamReach;
    tent.rotation.z = Math.cos(phase * 1.3 * speedMul + idx) * (0.24 + lashPulse * 0.32);
  });

  if (built.tailFin) {
    built.tailFin.rotation.y = Math.sin(phase * 2.1 * speedMul) * 0.32;
  }

  if (built.jaw) {
    if (attackStyle === 'ram_bite' && attackAnimProgress > 0) {
      // Wide open approach -> snap shut biting ship hull!
      const chomp = attackAnimProgress > 0.45 ? (1 - attackAnimProgress) * 1.45 : Math.sin(attackAnimProgress * Math.PI * 2) * 0.68;
      built.jaw.rotation.x = Math.max(0.05, Math.min(0.75, Math.abs(chomp)));
    } else {
      built.jaw.rotation.x = attacking ? 0.38 + Math.abs(Math.sin(phase * 4.5)) * 0.26 : 0.08;
    }
  }
}
