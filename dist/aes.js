import { createDecipheriv } from "node:crypto";
/** Yach IM encrypted identifiers use AES-128-ECB with a zero-padded app key. */
export function aesDecrypt(value, appKey) {
    const key = Buffer.alloc(16);
    Buffer.from(appKey, "utf8").copy(key, 0, 0, 16);
    const ciphertext = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-128-ecb", key, null);
    decipher.setAutoPadding(false);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const padding = plaintext.at(-1) ?? 0;
    if (padding < 1 || padding > 16 || padding > plaintext.length) {
        throw new Error("invalid AES padding");
    }
    for (const byte of plaintext.subarray(plaintext.length - padding)) {
        if (byte !== padding)
            throw new Error("invalid AES padding");
    }
    return plaintext.subarray(0, plaintext.length - padding).toString("utf8");
}
//# sourceMappingURL=aes.js.map