import * as THREE from 'three';
import { createProceduralMaterialSet } from './proceduralMaps.ts';

export function createMaterialLibrary() {
  return {
    asphalt: createProceduralMaterialSet({ kind: 'asphalt', seed: 44, tint: [67, 70, 72], size: 512, repeat: [8, 8] }),
    concrete: createProceduralMaterialSet({ kind: 'concrete', seed: 37, tint: [108, 110, 106], repeat: [3, 2] }),
    zinc: createProceduralMaterialSet({ kind: 'zinc', seed: 7, tint: [120, 130, 135] }),
    steel: createProceduralMaterialSet({ kind: 'tool', seed: 16, tint: [66, 75, 79] }),
    rubber: createProceduralMaterialSet({ kind: 'rubber', seed: 21, tint: [31, 37, 39] }),
    timber: createProceduralMaterialSet({ kind: 'timber', seed: 13, tint: [119, 88, 55] }),
    safety: createProceduralMaterialSet({ kind: 'paint', seed: 53, tint: [173, 126, 46] }),
    ceramic: createProceduralMaterialSet({ kind: 'paint', seed: 68, tint: [170, 178, 167] }),
  };
}

export type Materials = ReturnType<typeof createMaterialLibrary>;

export function emissive(color: number, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .37 });
}
