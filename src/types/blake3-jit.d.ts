declare module 'blake3-jit' {
  export function hash(data: Buffer): Uint8Array;
  export function createHasher(): Hasher;
  export interface Hasher {
    update(data: Buffer): void;
    finalize(): Uint8Array;
  }
}
