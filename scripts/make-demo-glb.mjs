#!/usr/bin/env node
/**
 * Generates the tiny demo models used by the docsify demo (no dependencies).
 *
 * Run: node scripts/make-demo-glb.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets');
mkdirSync(outDir, { recursive: true });

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

/**
 * @param {{ positions: number[], normals: number[], indices: number[], color: [number, number, number, number], name: string }} model
 * @returns {Buffer}
 */
function buildGlb({ positions, normals, indices, color, name }) {
  const vertexCount = positions.length / 3;
  const positionBytes = Buffer.from(new Float32Array(positions).buffer);
  const normalBytes = Buffer.from(new Float32Array(normals).buffer);
  const indexBytes = Buffer.from(new Uint16Array(indices).buffer);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[i + axis]);
      max[axis] = Math.max(max[axis], positions[i + axis]);
    }
  }

  const chunks = [positionBytes, normalBytes, indexBytes];
  let offset = 0;
  const bufferViews = chunks.map((chunk, i) => {
    const view = {
      buffer: 0,
      byteOffset: offset,
      byteLength: chunk.length,
      target: i === 2 ? ELEMENT_ARRAY_BUFFER : ARRAY_BUFFER,
    };
    offset += chunk.length;
    // Keep all bufferViews 4-byte aligned.
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks[i] = Buffer.concat([chunk, Buffer.alloc(padding)]);
      offset += padding;
    }
    return view;
  });

  const binBytes = Buffer.concat(chunks);

  const json = {
    asset: { version: '2.0', generator: 'docsify-yacv demo generator' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [
      {
        name,
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0, mode: 4 }],
      },
    ],
    materials: [
      {
        name: `${name}_material`,
        pbrMetallicRoughness: {
          baseColorFactor: color,
          metallicFactor: 0.15,
          roughnessFactor: 0.5,
        },
        doubleSided: false,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: FLOAT,
        count: vertexCount,
        type: 'VEC3',
        min,
        max,
      },
      { bufferView: 1, componentType: FLOAT, count: vertexCount, type: 'VEC3' },
      { bufferView: 2, componentType: UNSIGNED_SHORT, count: indices.length, type: 'SCALAR' },
    ],
    bufferViews,
    buffers: [{ byteLength: binBytes.length }],
  };

  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPadding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);

  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBytes.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);

  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]);
}

function box(sizeX, sizeY, sizeZ) {
  const hx = sizeX / 2;
  const hy = sizeY / 2;
  const hz = sizeZ / 2;
  const positions = [];
  const normals = [];
  const indices = [];

  /** @param {number[]} normal @param {number[][]} corners */
  const face = (normal, corners) => {
    const base = positions.length / 3;
    for (const corner of corners) {
      positions.push(...corner);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // +X, -X, +Y, -Y, +Z, -Z (glTF is Y-up)
  face([1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]);
  face([-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]);
  face([0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]);
  face([0, -1, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]);
  face([0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]);
  face([0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]);

  return { positions, normals, indices };
}

function cylinder(radius, height, segments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const half = height / 2;

  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius;
    const z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius;
    const z1 = Math.sin(a1) * radius;
    const n0 = [Math.cos(a0), 0, Math.sin(a0)];
    const n1 = [Math.cos(a1), 0, Math.sin(a1)];
    const base = positions.length / 3;

    positions.push(x0, -half, z0, x1, -half, z1, x1, half, z1, x0, half, z0);
    normals.push(...n0, ...n1, ...n1, ...n0);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);

    // Bottom cap
    const bottomCenter = positions.length / 3;
    positions.push(0, -half, 0);
    normals.push(0, -1, 0);
    const bottom0 = positions.length / 3;
    positions.push(x0, -half, z0, x1, -half, z1);
    normals.push(0, -1, 0, 0, -1, 0);
    indices.push(bottomCenter, bottom0, bottom0 + 1);

    // Top cap
    const topCenter = positions.length / 3;
    positions.push(0, half, 0);
    normals.push(0, 1, 0);
    const top0 = positions.length / 3;
    positions.push(x0, half, z0, x1, half, z1);
    normals.push(0, 1, 0, 0, 1, 0);
    indices.push(topCenter, top0 + 1, top0);
  }

  return { positions, normals, indices };
}

const cube = box(20, 12, 14);
writeFileSync(
  path.join(outDir, 'cube.glb'),
  buildGlb({ ...cube, color: [0.16, 0.47, 0.8, 1], name: 'demo_cube' }),
);

const cyl = cylinder(6, 16, 48);
writeFileSync(
  path.join(outDir, 'cylinder.glb'),
  buildGlb({ ...cyl, color: [0.9, 0.45, 0.12, 1], name: 'demo_cylinder' }),
);

// eslint-disable-next-line no-console
console.log('Wrote assets/cube.glb and assets/cylinder.glb');
