// Generator angka acak berseed (mulberry32): seed yang sama memberi dunia yang sama,
// yang membuat adegan screenshot bisa diulang persis. Semua kode game memakai ini;
// Math.random tidak dipakai di mana pun di game.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed kecil yang stabil dari sebuah nama shot, supaya tiap shot punya dunianya sendiri. */
export function seedFromName(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}
