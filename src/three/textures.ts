import * as THREE from 'three';
import { CROPS, FILMS, SHEETS, type Film, type SheetId } from '../lib/films';

export interface FilmTexturePair {
  spine: THREE.CanvasTexture;
  cover: THREE.CanvasTexture;
}

export interface TextureBundle {
  byFilmId: Map<string, FilmTexturePair>;
  cardboardBump: THREE.CanvasTexture;
  dropShadow: THREE.CanvasTexture;
  dispose: () => void;
}

const SPINE_W = 256;
const SPINE_H = 1024;
const COVER_W = 512;
const COVER_H = 972;

function drawSpinePlaceholder(ctx: CanvasRenderingContext2D, film: Film) {
  ctx.fillStyle = '#E8E3D8';
  ctx.fillRect(0, 0, SPINE_W, SPINE_H);

  // Subtle paper wear border
  ctx.strokeStyle = 'rgba(20,20,20,0.22)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, SPINE_W - 16, SPINE_H - 16);

  // Top color accent block
  ctx.fillStyle = film.accentHex;
  ctx.fillRect(26, 36, SPINE_W - 52, 132);
  ctx.fillStyle = '#EDEBE6';
  ctx.fillRect(46, 56, SPINE_W - 92, 92);
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(SPINE_W / 2, 102, 26, 0, Math.PI * 2);
  ctx.fill();

  // Vertical title
  ctx.save();
  ctx.translate(SPINE_W / 2, 520);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#141414';
  ctx.font = '600 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(film.title.toUpperCase(), 0, 0, 560);
  ctx.restore();

  // Bottom VASARI & VHS badge
  ctx.fillStyle = '#141414';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VASARI', SPINE_W / 2, SPINE_H - 122);

  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 4;
  ctx.strokeRect(58, SPINE_H - 96, SPINE_W - 116, 52);
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText('VHS', SPINE_W / 2, SPINE_H - 62);
}

function drawCoverPlaceholder(ctx: CanvasRenderingContext2D, film: Film) {
  ctx.fillStyle = '#EAE5DA';
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  ctx.strokeStyle = 'rgba(20,20,20,0.18)';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, COVER_W - 24, COVER_H - 24);

  ctx.fillStyle = '#141414';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('A LEON VASARI FILM', COVER_W / 2, 66);

  ctx.font = '400 48px Georgia, serif';
  const words = film.title.toUpperCase().split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.slice(0, mid).join(' ');
  const line2 = words.slice(mid).join(' ');
  ctx.fillText(line1, COVER_W / 2, 146, COVER_W - 60);
  if (line2) {
    ctx.fillText(line2, COVER_W / 2, 204, COVER_W - 60);
  }

  // Screenprint duotone graphic placeholder
  ctx.fillStyle = film.accentHex;
  ctx.fillRect(46, 250, COVER_W - 92, 560);
  ctx.fillStyle = '#141414';
  ctx.beginPath();
  ctx.arc(COVER_W / 2, 530, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#EAE5DA';
  ctx.beginPath();
  ctx.arc(COVER_W / 2 + 24, 510, 74, 0, Math.PI * 2);
  ctx.fill();

  // Year & VHS badge
  ctx.fillStyle = '#141414';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${film.year} · ${film.kanji}`, 46, COVER_H - 64);

  ctx.strokeStyle = '#141414';
  ctx.lineWidth = 4;
  ctx.strokeRect(COVER_W - 140, COVER_H - 94, 94, 44);
  ctx.textAlign = 'center';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('VHS', COVER_W - 93, COVER_H - 64);
}

function createCardboardBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random cardboard paper fibers & subtle vertical creases
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = 114 + Math.floor(rand() * 28);
    data[i] = grain;
    data[i + 1] = grain;
    data[i + 2] = grain;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Fine cardboard crease streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 42; i++) {
    const x = rand() * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (rand() - 0.5) * 6, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  tex.needsUpdate = true;
  return tex;
}

function createDropShadowTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, 1.48);
  const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, w * 0.49);
  grad.addColorStop(0, 'rgba(20, 16, 10, 0.58)');
  grad.addColorStop(0.38, 'rgba(20, 16, 10, 0.36)');
  grad.addColorStop(0.72, 'rgba(20, 16, 10, 0.11)');
  grad.addColorStop(1, 'rgba(20, 16, 10, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.49, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createFilmTextureBundle(
  maxAnisotropy: number,
  onSheetLoaded: () => void
): TextureBundle {
  const byFilmId = new Map<string, FilmTexturePair>();
  const spineCanvases = new Map<string, HTMLCanvasElement>();
  const coverCanvases = new Map<string, HTMLCanvasElement>();

  for (const film of FILMS) {
    const spineCanvas = document.createElement('canvas');
    spineCanvas.width = SPINE_W;
    spineCanvas.height = SPINE_H;
    drawSpinePlaceholder(spineCanvas.getContext('2d')!, film);
    spineCanvases.set(film.id, spineCanvas);

    const coverCanvas = document.createElement('canvas');
    coverCanvas.width = COVER_W;
    coverCanvas.height = COVER_H;
    drawCoverPlaceholder(coverCanvas.getContext('2d')!, film);
    coverCanvases.set(film.id, coverCanvas);

    const spineTex = new THREE.CanvasTexture(spineCanvas);
    spineTex.colorSpace = THREE.SRGBColorSpace;
    spineTex.anisotropy = maxAnisotropy;
    spineTex.minFilter = THREE.LinearMipmapLinearFilter;
    spineTex.magFilter = THREE.LinearFilter;
    spineTex.needsUpdate = true;

    const coverTex = new THREE.CanvasTexture(coverCanvas);
    coverTex.colorSpace = THREE.SRGBColorSpace;
    coverTex.anisotropy = maxAnisotropy;
    coverTex.minFilter = THREE.LinearMipmapLinearFilter;
    coverTex.magFilter = THREE.LinearFilter;
    coverTex.needsUpdate = true;

    byFilmId.set(film.id, { spine: spineTex, cover: coverTex });
  }

  let disposed = false;

  // Preload all 4 Higgsfield sprite sheets and slice exact crop boxes onto the CanvasTextures
  (Object.keys(SHEETS) as SheetId[]).forEach((sheetId) => {
    const spec = SHEETS[sheetId];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      if (disposed) return;

      // Scale factor in case image proxy returned slightly different pixel size than nominal WxH
      const sxScale = img.naturalWidth / spec.width;
      const syScale = img.naturalHeight / spec.height;

      for (const film of FILMS) {
        const pair = byFilmId.get(film.id)!;

        const spineCrop = CROPS[`spine-${film.id}`];
        if (spineCrop.sheet === sheetId) {
          const canvas = spineCanvases.get(film.id)!;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#EAE5DC';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            img,
            spineCrop.x * sxScale,
            spineCrop.y * syScale,
            spineCrop.w * sxScale,
            spineCrop.h * syScale,
            0,
            0,
            canvas.width,
            canvas.height
          );
          pair.spine.needsUpdate = true;
        }

        const coverCrop = CROPS[`cover-${film.id}`];
        if (coverCrop.sheet === sheetId) {
          const canvas = coverCanvases.get(film.id)!;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#EAE5DC';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            img,
            coverCrop.x * sxScale,
            coverCrop.y * syScale,
            coverCrop.w * sxScale,
            coverCrop.h * syScale,
            0,
            0,
            canvas.width,
            canvas.height
          );
          pair.cover.needsUpdate = true;
        }
      }

      onSheetLoaded();
    };
    img.src = spec.url;
  });

  const cardboardBump = createCardboardBumpTexture();
  const dropShadow = createDropShadowTexture();

  return {
    byFilmId,
    cardboardBump,
    dropShadow,
    dispose: () => {
      disposed = true;
      byFilmId.forEach(({ spine, cover }) => {
        spine.dispose();
        cover.dispose();
      });
      cardboardBump.dispose();
      dropShadow.dispose();
    },
  };
}
