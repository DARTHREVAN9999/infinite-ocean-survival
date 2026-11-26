import * as THREE from 'three';
import { FLAG_DYES } from '../game/economy';
import { PIRATE_FACTIONS } from '../game/factions';
import { CustomFlagConfig, FlagEmblemId, PirateFactionId, VesselClass } from '../game/types';

export interface ProceduralTextureSet {
  woodHullMap: THREE.CanvasTexture;
  woodHullBump: THREE.CanvasTexture;
  woodDeckMap: THREE.CanvasTexture;
  sailPlayerMap: THREE.CanvasTexture;
  sailMerchantMap: THREE.CanvasTexture;
  sailCrownMap: THREE.CanvasTexture;
  sailPirateMap: THREE.CanvasTexture;
  sailTornMap: THREE.CanvasTexture;
  sailGhostMap: THREE.CanvasTexture;
  ironPlateMap: THREE.CanvasTexture;
  ironBump: THREE.CanvasTexture;
  sprayTexture: THREE.CanvasTexture;
  ghostCloudMap: THREE.CanvasTexture;
  getCachedFlagTexture: (key: string, cfg: CustomFlagConfig) => THREE.CanvasTexture;
  getCachedSailTexture: (key: string, cfg: CustomFlagConfig) => THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function createWoodPlanks(
  baseHex: string,
  darkHex: string,
  lightHex: string,
  weathered: boolean,
  maxAniso: number
): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [c, ctx] = makeCanvas(256, 256);
  const [bc, bctx] = makeCanvas(256, 256);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);

  const plankH = 32;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    ctx.fillStyle = row % 2 === 0 ? baseHex : weathered ? '#574a3e' : lightHex;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, y, 256, plankH);
    ctx.globalAlpha = 1;

    for (let g = 0; g < 18; g++) {
      const gy = y + 2 + ((g * 17 + row * 7) % (plankH - 4));
      ctx.strokeStyle = g % 3 === 0 ? darkHex : lightHex;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(85, gy + Math.sin(g + row) * 2.2, 170, gy - Math.cos(g) * 2.2, 256, gy);
      ctx.stroke();

      bctx.strokeStyle = g % 2 === 0 ? '#9c9c9c' : '#646464';
      bctx.globalAlpha = 0.35;
      bctx.beginPath();
      bctx.moveTo(0, gy);
      bctx.lineTo(256, gy);
      bctx.stroke();
    }
    ctx.globalAlpha = 1;
    bctx.globalAlpha = 1;

    ctx.fillStyle = '#18100a';
    ctx.fillRect(0, y, 256, 2);
    bctx.fillStyle = '#202020';
    bctx.fillRect(0, y, 256, 3);

    const jointX = ((row * 97 + 40) % 210) + 20;
    ctx.fillStyle = '#1b120b';
    ctx.fillRect(jointX, y, 2, plankH);
    bctx.fillStyle = '#242424';
    bctx.fillRect(jointX, y, 2, plankH);

    ctx.fillStyle = '#231f1b';
    ctx.fillRect(jointX - 6, y + 7, 3, 3);
    ctx.fillRect(jointX - 6, y + plankH - 10, 3, 3);
    ctx.fillRect(jointX + 5, y + 7, 3, 3);
    ctx.fillRect(jointX + 5, y + plankH - 10, 3, 3);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const bump = new THREE.CanvasTexture(bc);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = maxAniso;

  return { map, bump };
}

function createSailTexture(
  variant: 'player' | 'merchant' | 'crown' | 'pirate' | 'torn' | 'ghost',
  maxAniso: number
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);

  if (variant === 'player') {
    ctx.fillStyle = '#e7dcc5';
  } else if (variant === 'merchant') {
    ctx.fillStyle = '#efe6d4';
  } else if (variant === 'crown') {
    ctx.fillStyle = '#e8eef7';
  } else if (variant === 'pirate') {
    ctx.fillStyle = '#252221';
  } else if (variant === 'ghost') {
    ctx.fillStyle = '#364d4e';
  } else {
    ctx.fillStyle = '#8d8371';
  }
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = variant === 'pirate' ? 'rgba(255,255,255,0.08)' : 'rgba(92,70,45,0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(0,0,0,0.08)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(20,14,8,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  if (variant === 'player') {
    ctx.fillStyle = 'rgba(30, 62, 92, 0.72)';
    ctx.fillRect(0, 112, 256, 18);
    ctx.fillStyle = 'rgba(201, 157, 78, 0.85)';
    ctx.fillRect(0, 108, 256, 4);
    ctx.fillRect(0, 130, 256, 4);
  } else if (variant === 'merchant') {
    ctx.fillStyle = '#8b2626';
    ctx.fillRect(0, 48, 256, 28);
    ctx.fillRect(0, 180, 256, 28);
    ctx.fillStyle = '#c89b3c';
    ctx.fillRect(0, 114, 256, 24);
  } else if (variant === 'crown') {
    // Royal Navy Admiralty bands & golden crown crest
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 28, 256, 26);
    ctx.fillRect(0, 202, 256, 26);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 56, 256, 5);
    ctx.fillRect(0, 195, 256, 5);
    drawEmblem(ctx, 128, 128, 36, 'crown', '#1e3a8a', '#eab308');
  } else if (variant === 'pirate') {
    ctx.fillStyle = '#dcd4c6';
    ctx.beginPath();
    ctx.arc(128, 108, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(112, 130, 32, 18);
    ctx.fillStyle = '#1b1817';
    ctx.beginPath();
    ctx.arc(116, 108, 7, 0, Math.PI * 2);
    ctx.arc(140, 108, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c84b3e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(76, 174);
    ctx.lineTo(180, 140);
    ctx.moveTo(180, 174);
    ctx.lineTo(76, 140);
    ctx.stroke();
  } else if (variant === 'ghost') {
    // Weathered spectral canvas with eerie teal wash and ragged dark holes
    const gGrad = ctx.createRadialGradient(128, 128, 18, 128, 128, 145);
    gGrad.addColorStop(0, 'rgba(130, 247, 224, 0.34)');
    gGrad.addColorStop(1, 'rgba(18, 30, 34, 0.42)');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(15, 22, 24, 0.56)';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc((i * 47 + 22) % 235, (i * 83 + 18) % 235, 10 + (i % 5) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(42,35,26,0.42)';
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.arc((i * 53) % 240, (i * 89) % 240, 12 + (i % 4) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function drawEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  emblem: FlagEmblemId,
  color: string,
  accent: string
): void {
  if (emblem === 'none') return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (emblem === 'anchor') {
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.58, r * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.38);
    ctx.lineTo(cx, cy + r * 0.65);
    ctx.moveTo(cx - r * 0.42, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.42, cy - r * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.12, r * 0.58, 0.25, Math.PI - 0.25);
    ctx.stroke();
  } else if (emblem === 'skull') {
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.12, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - r * 0.24, cy + r * 0.16, r * 0.48, r * 0.34);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx - r * 0.17, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.17, cy - r * 0.1, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.75, cy + r * 0.65);
    ctx.lineTo(cx + r * 0.75, cy + r * 0.25);
    ctx.moveTo(cx + r * 0.75, cy + r * 0.65);
    ctx.lineTo(cx - r * 0.75, cy + r * 0.25);
    ctx.stroke();
  } else if (emblem === 'crossed_swords') {
    ctx.lineWidth = Math.max(3, r * 0.15);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.72, cy + r * 0.65);
    ctx.lineTo(cx + r * 0.72, cy - r * 0.65);
    ctx.moveTo(cx + r * 0.72, cy + r * 0.65);
    ctx.lineTo(cx - r * 0.72, cy - r * 0.65);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.56, cy + r * 0.28);
    ctx.lineTo(cx - r * 0.26, cy + r * 0.58);
    ctx.moveTo(cx + r * 0.56, cy + r * 0.28);
    ctx.lineTo(cx + r * 0.26, cy + r * 0.58);
    ctx.stroke();
  } else if (emblem === 'crown') {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.68, cy + r * 0.45);
    ctx.lineTo(cx - r * 0.76, cy - r * 0.35);
    ctx.lineTo(cx - r * 0.32, cy + r * 0.05);
    ctx.lineTo(cx, cy - r * 0.55);
    ctx.lineTo(cx + r * 0.32, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.76, cy - r * 0.35);
    ctx.lineTo(cx + r * 0.68, cy + r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(cx - r * 0.7, cy + r * 0.32, r * 1.4, r * 0.18);
  } else if (emblem === 'kraken') {
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.28, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, r * 0.13);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * r * 0.16, cy);
      ctx.quadraticCurveTo(
        cx + i * r * 0.36,
        cy + r * 0.35,
        cx + i * r * 0.44,
        cy + r * 0.72
      );
      ctx.stroke();
    }
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx - r * 0.14, cy - r * 0.28, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.14, cy - r * 0.28, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'sunburst') {
    ctx.fillStyle = accent;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, r * 0.11);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
      ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'trident') {
    ctx.lineWidth = Math.max(3, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.75);
    ctx.lineTo(cx, cy - r * 0.72);
    ctx.moveTo(cx - r * 0.42, cy - r * 0.12);
    ctx.lineTo(cx + r * 0.42, cy - r * 0.12);
    ctx.moveTo(cx - r * 0.42, cy - r * 0.12);
    ctx.lineTo(cx - r * 0.42, cy - r * 0.56);
    ctx.moveTo(cx + r * 0.42, cy - r * 0.12);
    ctx.lineTo(cx + r * 0.42, cy - r * 0.56);
    ctx.stroke();
  } else if (emblem === 'serpent') {
    ctx.lineWidth = Math.max(4, r * 0.2);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy + r * 0.55);
    ctx.bezierCurveTo(
      cx - r * 0.75,
      cy - r * 0.25,
      cx + r * 0.65,
      cy + r * 0.35,
      cx + r * 0.35,
      cy - r * 0.55
    );
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx + r * 0.38, cy - r * 0.58, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (emblem === 'dragon_crest') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.75);
    ctx.lineTo(cx + r * 0.68, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.32, cy + r * 0.68);
    ctx.lineTo(cx, cy + r * 0.35);
    ctx.lineTo(cx - r * 0.32, cy + r * 0.68);
    ctx.lineTo(cx - r * 0.68, cy - r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2.5, r * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFlagToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cfg: CustomFlagConfig
): void {
  const c1 = FLAG_DYES[cfg.primaryDye]?.hex ?? '#1d4ed8';
  const c2 = FLAG_DYES[cfg.secondaryDye]?.hex ?? '#eab308';
  const c3 = FLAG_DYES[cfg.accentDye]?.hex ?? '#f8fafc';

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  // Clip by flag shape
  ctx.beginPath();
  if (cfg.shape === 'swallowtail') {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w * 0.74, h * 0.5);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
  } else if (cfg.shape === 'pennant') {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h * 0.38);
    ctx.lineTo(w, h * 0.62);
    ctx.lineTo(0, h);
  } else if (cfg.shape === 'burgee') {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h * 0.22);
    ctx.lineTo(w * 0.78, h * 0.5);
    ctx.lineTo(w, h * 0.78);
    ctx.lineTo(0, h);
  } else {
    ctx.rect(0, 0, w, h);
  }
  ctx.closePath();
  ctx.clip();

  // Base fill
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, w, h);

  // Pattern
  if (cfg.pattern === 'horizontal_bicolor') {
    ctx.fillStyle = c2;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  } else if (cfg.pattern === 'vertical_bicolor') {
    ctx.fillStyle = c2;
    ctx.fillRect(w * 0.5, 0, w * 0.5, h);
  } else if (cfg.pattern === 'saltire') {
    ctx.strokeStyle = c2;
    ctx.lineWidth = Math.max(8, h * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
  } else if (cfg.pattern === 'chevron') {
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.48, h * 0.5);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  } else if (cfg.pattern === 'bordered') {
    ctx.strokeStyle = c2;
    ctx.lineWidth = Math.max(10, h * 0.2);
    ctx.strokeRect(0, 0, w, h);
  } else if (cfg.pattern === 'quartered') {
    ctx.fillStyle = c2;
    ctx.fillRect(w * 0.5, 0, w * 0.5, h * 0.5);
    ctx.fillRect(0, h * 0.5, w * 0.5, h * 0.5);
  } else if (cfg.pattern === 'striped') {
    ctx.fillStyle = c2;
    for (let i = 1; i < 6; i += 2) {
      ctx.fillRect(0, (i / 6) * h, w, h / 6);
    }
  }

  // Decorative border
  if (cfg.decorativeBorder) {
    ctx.strokeStyle = c3;
    ctx.lineWidth = Math.max(4, h * 0.06);
    ctx.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
  }

  // Subtle fabric weave shading
  const shade = ctx.createLinearGradient(0, 0, w, h);
  shade.addColorStop(0, 'rgba(255,255,255,0.08)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);

  // Center emblem
  const emblemX = cfg.shape === 'pennant' ? w * 0.34 : w * 0.46;
  drawEmblem(ctx, emblemX, h * 0.5, Math.min(w, h) * 0.32, cfg.emblem, c3, c2);

  ctx.restore();
}

export function createCustomFlagTexture(cfg: CustomFlagConfig, maxAniso = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 160);
  drawFlagToCanvas(ctx, 256, 160, cfg);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createCustomSailTexture(cfg: CustomFlagConfig, maxAniso = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  const c1 = FLAG_DYES[cfg.primaryDye]?.hex ?? '#1d4ed8';
  const c2 = FLAG_DYES[cfg.secondaryDye]?.hex ?? '#eab308';
  const c3 = FLAG_DYES[cfg.accentDye]?.hex ?? '#f8fafc';

  const isPlainStarter =
    cfg.primaryDye === 'weathered_gray' &&
    cfg.pattern === 'solid' &&
    cfg.emblem === 'none' &&
    !cfg.decorativeBorder;

  if (isPlainStarter) {
    // Plain neutral weathered gray sailcloth with woven seams only (no colored bands or emblem)
    ctx.fillStyle = '#939aa3';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(36,42,48,0.26)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    const shade = ctx.createLinearGradient(0, 0, 0, 256);
    shade.addColorStop(0, 'rgba(255,255,255,0.06)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(15,20,28,0.22)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  ctx.fillStyle = '#e8dec8';
  ctx.fillRect(0, 0, 256, 256);

  // Woven sail cloth seams
  ctx.strokeStyle = 'rgba(92,70,45,0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  // Ensure light Ivory dye remains high-contrast against cream woven canvas
  const bandPrimary = cfg.primaryDye === 'ivory' ? c2 : c1;
  const bandTrim = cfg.primaryDye === 'ivory' ? c3 : c2;
  const emblemMain = cfg.primaryDye === 'ivory' ? c2 : c1;

  // Flag-matched upper & lower bands
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = bandPrimary;
  ctx.fillRect(0, 22, 256, 26);
  ctx.fillRect(0, 208, 256, 26);
  ctx.fillStyle = bandTrim;
  ctx.fillRect(0, 50, 256, 8);
  ctx.fillRect(0, 198, 256, 8);
  ctx.restore();

  // Subtle emblem crest in sail center
  if (cfg.emblem !== 'none') {
    ctx.save();
    ctx.globalAlpha = 0.82;
    drawEmblem(ctx, 128, 128, 34, cfg.emblem, emblemMain, c3);
    ctx.restore();
  }

  const shade = ctx.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(0,0,0,0.06)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(20,14,8,0.2)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createFactionFlagConfig(factionId: PirateFactionId): CustomFlagConfig {
  const meta = PIRATE_FACTIONS[factionId];
  const configs: Record<PirateFactionId, CustomFlagConfig> = {
    crimson_corsairs: {
      primaryDye: 'crimson',
      secondaryDye: 'obsidian',
      accentDye: 'bone_silver',
      pattern: 'chevron',
      emblem: meta.emblem,
      shape: 'swallowtail',
      decorativeBorder: true,
    },
    iron_brotherhood: {
      primaryDye: 'obsidian',
      secondaryDye: 'bone_silver',
      accentDye: 'amber',
      pattern: 'bordered',
      emblem: meta.emblem,
      shape: 'burgee',
      decorativeBorder: true,
    },
    gilded_vultures: {
      primaryDye: 'amber',
      secondaryDye: 'gold',
      accentDye: 'ivory',
      pattern: 'quartered',
      emblem: meta.emblem,
      shape: 'rectangle',
      decorativeBorder: true,
    },
    tempest_reavers: {
      primaryDye: 'teal_abyss',
      secondaryDye: 'navy',
      accentDye: 'bone_silver',
      pattern: 'saltire',
      emblem: meta.emblem,
      shape: 'swallowtail',
      decorativeBorder: false,
    },
    abyssal_fleet: {
      primaryDye: 'royal_purple',
      secondaryDye: 'obsidian',
      accentDye: 'teal_abyss',
      pattern: 'chevron',
      emblem: meta.emblem,
      shape: 'pennant',
      decorativeBorder: true,
    },
    obsidian_armada: {
      primaryDye: 'obsidian',
      secondaryDye: 'crimson',
      accentDye: 'bone_silver',
      pattern: 'vertical_bicolor',
      emblem: meta.emblem,
      shape: 'rectangle',
      decorativeBorder: true,
    },
    scarlet_sisterhood: {
      primaryDye: 'crimson',
      secondaryDye: 'burnished_bronze',
      accentDye: 'gold',
      pattern: 'striped',
      emblem: meta.emblem,
      shape: 'swallowtail',
      decorativeBorder: false,
    },
    emerald_marauders: {
      primaryDye: 'emerald',
      secondaryDye: 'gold',
      accentDye: 'ivory',
      pattern: 'bordered',
      emblem: meta.emblem,
      shape: 'rectangle',
      decorativeBorder: true,
    },
    siren_cutthroats: {
      primaryDye: 'violet',
      secondaryDye: 'teal_abyss',
      accentDye: 'ivory',
      pattern: 'saltire',
      emblem: meta.emblem,
      shape: 'burgee',
      decorativeBorder: true,
    },
    ashen_raiders: {
      primaryDye: 'burnished_bronze',
      secondaryDye: 'obsidian',
      accentDye: 'amber',
      pattern: 'horizontal_bicolor',
      emblem: meta.emblem,
      shape: 'swallowtail',
      decorativeBorder: true,
    },
  };
  return configs[factionId] ?? configs.crimson_corsairs;
}

export function createCrownFlagConfig(): CustomFlagConfig {
  return {
    primaryDye: 'navy',
    secondaryDye: 'ivory',
    accentDye: 'gold',
    pattern: 'saltire',
    emblem: 'crown',
    shape: 'rectangle',
    decorativeBorder: true,
  };
}

export function createMerchantFlagConfig(vesselClass: VesselClass): CustomFlagConfig {
  if (vesselClass === 'fishing_boat' || vesselClass === 'fishing_trawler') {
    return {
      primaryDye: 'navy',
      secondaryDye: 'ivory',
      accentDye: 'gold',
      pattern: 'horizontal_bicolor',
      emblem: 'anchor',
      shape: 'rectangle',
      decorativeBorder: false,
    };
  }
  if (vesselClass === 'treasure_ship' || vesselClass === 'wealthy_trader') {
    return {
      primaryDye: 'gold',
      secondaryDye: 'navy',
      accentDye: 'crimson',
      pattern: 'horizontal_bicolor',
      emblem: 'sunburst',
      shape: 'rectangle',
      decorativeBorder: true,
    };
  }
  return {
    primaryDye: 'crimson',
    secondaryDye: 'ivory',
    accentDye: 'gold',
    pattern: 'horizontal_bicolor',
    emblem: 'sunburst',
    shape: 'rectangle',
    decorativeBorder: false,
  };
}

function createIronPlate(maxAniso: number): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const [c, ctx] = makeCanvas(128, 128);
  const [bc, bctx] = makeCanvas(128, 128);

  ctx.fillStyle = '#363b42';
  ctx.fillRect(0, 0, 128, 128);
  bctx.fillStyle = '#707070';
  bctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = '#202429';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 60);
  ctx.strokeRect(2, 66, 124, 60);

  for (let x = 12; x < 120; x += 20) {
    for (const y of [10, 54, 74, 118]) {
      ctx.fillStyle = '#535b65';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      bctx.fillStyle = '#d8d8d8';
      bctx.beginPath();
      bctx.arc(x, y, 3, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAniso;

  const bump = new THREE.CanvasTexture(bc);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = maxAniso;

  return { map, bump };
}

function createSoftSprayTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.45, 'rgba(225, 240, 248, 0.55)');
  grad.addColorStop(1, 'rgba(200, 225, 240, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGhostCloudTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  const lobes = [
    { x: 64, y: 64, r: 54, a: 0.72 },
    { x: 42, y: 58, r: 38, a: 0.55 },
    { x: 86, y: 60, r: 36, a: 0.52 },
    { x: 62, y: 42, r: 34, a: 0.48 },
    { x: 66, y: 82, r: 32, a: 0.46 },
  ];
  for (const lb of lobes) {
    const g = ctx.createRadialGradient(lb.x, lb.y, 4, lb.x, lb.y, lb.r);
    g.addColorStop(0, `rgba(94, 255, 162, ${lb.a})`);
    g.addColorStop(0.42, `rgba(26, 204, 108, ${lb.a * 0.62})`);
    g.addColorStop(0.75, `rgba(14, 128, 68, ${lb.a * 0.24})`);
    g.addColorStop(1, 'rgba(8, 80, 42, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lb.x, lb.y, lb.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const hull = createWoodPlanks('#5a3922', '#2f1c0f', '#734b2f', false, maxAniso);
  const deck = createWoodPlanks('#8b6b49', '#4c3823', '#a68560', true, maxAniso);
  const iron = createIronPlate(maxAniso);

  const sailPlayerMap = createSailTexture('player', maxAniso);
  const sailMerchantMap = createSailTexture('merchant', maxAniso);
  const sailCrownMap = createSailTexture('crown', maxAniso);
  const sailPirateMap = createSailTexture('pirate', maxAniso);
  const sailTornMap = createSailTexture('torn', maxAniso);
  const sailGhostMap = createSailTexture('ghost', maxAniso);
  const sprayTexture = createSoftSprayTexture();
  const ghostCloudMap = createGhostCloudTexture();

  const all = [
    hull.map,
    hull.bump,
    deck.map,
    deck.bump,
    iron.map,
    iron.bump,
    sailPlayerMap,
    sailMerchantMap,
    sailCrownMap,
    sailPirateMap,
    sailTornMap,
    sailGhostMap,
    sprayTexture,
    ghostCloudMap,
  ];

  const flagCache = new Map<string, THREE.CanvasTexture>();
  const sailCache = new Map<string, THREE.CanvasTexture>();

  const getCachedFlagTexture = (key: string, cfg: CustomFlagConfig): THREE.CanvasTexture => {
    let tex = flagCache.get(key);
    if (!tex) {
      tex = createCustomFlagTexture(cfg, maxAniso);
      flagCache.set(key, tex);
    }
    return tex;
  };

  const getCachedSailTexture = (key: string, cfg: CustomFlagConfig): THREE.CanvasTexture => {
    let tex = sailCache.get(key);
    if (!tex) {
      tex = createCustomSailTexture(cfg, maxAniso);
      sailCache.set(key, tex);
    }
    return tex;
  };

  return {
    woodHullMap: hull.map,
    woodHullBump: hull.bump,
    woodDeckMap: deck.map,
    sailPlayerMap,
    sailMerchantMap,
    sailCrownMap,
    sailPirateMap,
    sailTornMap,
    sailGhostMap,
    ironPlateMap: iron.map,
    ironBump: iron.bump,
    sprayTexture,
    ghostCloudMap,
    getCachedFlagTexture,
    getCachedSailTexture,
    dispose: () => {
      all.forEach((t) => t.dispose());
      flagCache.forEach((t) => t.dispose());
      sailCache.forEach((t) => t.dispose());
    },
  };
}
