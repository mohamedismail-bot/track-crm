import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export interface StoredUpload {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export async function storeUpload(file: File, prefix: string): Promise<StoredUpload> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filename = `${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${prefix}/${filename}`, buffer, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      url: blob.url,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    };
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return {
    url: `/uploads/${filename}`,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  };
}