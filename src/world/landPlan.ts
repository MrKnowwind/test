export const landBounds = { minX: -172, maxX: 228, minZ: -220, maxZ: 180 };

// The working quay, road ends and established terraces retain their footprints.
export const landOutline = [
  [-165,-220],[225,-220],[228,-196],[228,-139],[221,-111],[224,-72],
  [228,-35],[221,21],[218,65],[228,112],[225,153],[215,172],[191,180],
  [-134,180],[-157,174],[-167,159],[-172,132],[-166,87],[-172,55],
  [-172,-65],[-168,-91],[-172,-116],[-162,-148],[-165,-184],
] as const;

export function isLandAt(x: number, z: number) {
  if (x < landBounds.minX || x > landBounds.maxX || z < landBounds.minZ || z > landBounds.maxZ) return false;
  // The inner rectangle is wholly inside the outline and covers the busiest ground.
  if (x >= -155 && x <= 210 && z >= -215 && z <= 173) return true;
  let inside = false;
  for (let i = 0; i < landOutline.length; i++) {
    const [ax, az] = landOutline[i];
    const [bx, bz] = landOutline[(i + 1) % landOutline.length];
    if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && z >= Math.min(az, bz) && z <= Math.max(az, bz)
        && Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) < 1e-7) return true;
    if ((az > z) !== (bz > z) && x < ax + (z - az) * (bx - ax) / (bz - az)) inside = !inside;
  }
  return inside;
}
