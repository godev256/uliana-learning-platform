// LAN previews use HTTP, where randomUUID is unavailable on phones and tablets.
// These IDs identify local drawing objects; getRandomValues also works over HTTP.
export function boardId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte,index)=>([4,6,8,10].includes(index) ? "-" : "")+byte.toString(16).padStart(2,"0")).join("");
}
