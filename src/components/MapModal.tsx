import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { SaveData } from '../game/types';

interface MapModalProps {
  save: SaveData;
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = ({ save, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const px = save.player.x;
    const pz = save.player.z;
    const scale = 0.28;

    ctx.fillStyle = '#dec9a0';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(92, 66, 38, 0.16)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 48) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(72, 126, 152, 0.34)';
    const cellPx = 60 * scale;
    for (const key of save.exploredCells) {
      const [cxStr, czStr] = key.split(',');
      const wx = Number(cxStr) * 60;
      const wz = Number(czStr) * 60;
      const sx = w * 0.5 + (wx - px) * scale;
      const sy = h * 0.5 + (wz - pz) * scale;
      ctx.fillRect(sx, sy, cellPx + 1, cellPx + 1);
    }

    for (const m of save.markers) {
      const sx = w * 0.5 + (m.x - px) * scale;
      const sy = h * 0.5 + (m.z - pz) * scale;
      if (sx < 14 || sx > w - 14 || sy < 14 || sy > h - 14) continue;

      if (m.kind === 'wreck') {
        const isDone = m.status === 'Looted' || m.status === 'Fully Searched';
        ctx.fillStyle = isDone ? '#7a6e5d' : '#8b4e24';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
        if (isDone) {
          ctx.fillStyle = '#4e9f76';
          ctx.beginPath();
          ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (m.kind === 'merchant') {
        ctx.fillStyle = '#256c4e';
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
      } else if (m.kind === 'crown') {
        ctx.fillStyle = '#1e4278';
        ctx.fillRect(sx - 6, sy - 6, 12, 12);
      } else if (m.kind === 'convoy') {
        ctx.fillStyle = '#2f855a';
        ctx.fillRect(sx - 7, sy - 5, 8, 8);
        ctx.fillStyle = '#efc570';
        ctx.fillRect(sx - 1, sy - 2, 7, 7);
      } else if (m.kind === 'battle') {
        ctx.fillStyle = '#e05a4d';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4;
          const rad = i % 2 === 0 ? 8 : 3.5;
          const bx = sx + Math.cos(ang) * rad;
          const by = sy + Math.sin(ang) * rad;
          if (i === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#efc570';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.kind === 'ghost') {
        ctx.fillStyle = '#5eead4';
        ctx.strokeStyle = '#0f3a3a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 7);
        ctx.lineTo(sx + 7, sy);
        ctx.lineTo(sx, sy + 7);
        ctx.lineTo(sx - 7, sy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (m.kind === 'pirate') {
        ctx.fillStyle = '#a82c24';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 6);
        ctx.lineTo(sx + 6, sy + 5);
        ctx.lineTo(sx - 6, sy + 5);
        ctx.closePath();
        ctx.fill();
      } else if (m.kind === 'monster') {
        ctx.fillStyle = '#12706b';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 7);
        ctx.lineTo(sx + 7, sy);
        ctx.lineTo(sx, sy + 7);
        ctx.lineTo(sx - 7, sy);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = '#2b1d11';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(m.name, sx + 9, sy + 4);
    }

    // Player vessel
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-save.player.heading);
    ctx.fillStyle = '#1b2d42';
    ctx.strokeStyle = '#f4ead5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Compass rose
    const rx = w - 46;
    const ry = 46;
    ctx.strokeStyle = '#4a341c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(rx, ry, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#4a341c';
    ctx.font = 'bold 11px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', rx, ry - 11);
    ctx.fillText('S', rx, ry + 19);
    ctx.fillText('W', rx - 15, ry + 4);
    ctx.fillText('E', rx + 15, ry + 4);
    ctx.textAlign = 'left';
  }, [save]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/72 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nautical Sea Chart"
    >
      <div className="parchment-sheet rounded-lg w-full max-w-5xl max-h-[89vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#7a5a32]/30 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#2b1d11]">Nautical Sea Chart</h2>
            <p className="text-sm text-[#61482c] font-mono-num">
              Position ({Math.round(save.player.x)}E, {Math.round(-save.player.z)}N) ·{' '}
              {save.exploredCells.length} Charted Sectors · {Math.round(save.stats.distanceSailed)}m Sailed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sea Chart"
            className="p-2 text-[#5c4226] hover:text-[#1f1309] hover:bg-[#d8c39b] rounded cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-y-auto">
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            <canvas
              ref={canvasRef}
              width={640}
              height={440}
              className="w-full h-auto rounded border border-[#7a5a32]/50"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#4a341c] font-semibold">
              <span>Blue: Explored</span>
              <span className="text-[#8b4e24]">● Wreck</span>
              <span className="text-[#256c4e]">■ Merchant</span>
              <span className="text-[#1e4278]">■ Crown Navy</span>
              <span className="text-[#2f855a]">▣ Convoy</span>
              <span className="text-[#a82c24]">▲ Pirate</span>
              <span className="text-[#c0392b]">✦ Major Battle</span>
              <span className="text-[#0e7490]">◈ Ghost Ship</span>
              <span className="text-[#12706b]">◆ Sea Beast</span>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[440px] pr-1">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#5b3f20]">
              Charted Sightings ({save.markers.length})
            </h3>
            {save.markers.length === 0 ? (
              <p className="text-sm text-[#6d5438] italic">
                Sail into the open ocean to reveal uncharted waters, vessels, wrecks, and leviathans.
              </p>
            ) : (
              save.markers.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded bg-[#efe3c8] border border-[#8c6b42]/35 text-xs space-y-0.5"
                >
                  <div className="font-bold text-[#2b1d11]">{m.name}</div>
                  <div className="text-[#61482c] capitalize">
                    {m.kind} · {m.status}
                  </div>
                  <div className="font-mono-num text-[11px] text-[#7a5d3b]">
                    Coords ({Math.round(m.x)}E, {Math.round(-m.z)}N) · Dist{' '}
                    {Math.round(Math.hypot(m.x - save.player.x, m.z - save.player.z))}m
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
