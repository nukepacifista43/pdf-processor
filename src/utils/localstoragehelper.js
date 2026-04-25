// src/utils/localstoragehelper.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORAGE_ROOT = process.env.STORAGE_BASE_PATH || "/var/www/storage";
const BASE_URL =
  process.env.APP_URL ||
  process.env.STORAGE_PUBLIC_URL ||
  "";

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildLocalPath(prefix, originalNameOrFile = "", options = {}) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  const originalName =
    typeof originalNameOrFile === "string"
      ? originalNameOrFile
      : originalNameOrFile?.originalname || "";

  const mimeType =
    options.mimeType ||
    (typeof originalNameOrFile === "object"
      ? originalNameOrFile?.mimetype
      : "") ||
    "";

  const originalExt = path.extname(originalName).toLowerCase();

  let extFromMime = "";
  if (!originalExt && mimeType === "application/pdf") {
    extFromMime = ".pdf";
  }

  const isImageByExt = IMAGE_EXTS.has(originalExt);
  const isImageByMime =
    typeof mimeType === "string" && mimeType.startsWith("image/");
  const isImage = isImageByMime || isImageByExt;

  const forceExt = options.forceExt
    ? String(options.forceExt).toLowerCase()
    : null;

  const keepOriginalExt = !!options.keepOriginalExt;

  const convertImageToWebp =
    options.convertImageToWebp !== undefined
      ? !!options.convertImageToWebp
      : true;

  let finalExt = originalExt || extFromMime || "";

  if (forceExt) {
    finalExt = forceExt.startsWith(".")
      ? forceExt
      : `.${forceExt}`;
  } else if (keepOriginalExt) {
    finalExt = originalExt || extFromMime || "";
  } else if (isImage && convertImageToWebp) {
    finalExt = ".webp";
  } else {
    finalExt = originalExt || extFromMime || "";
  }

  const fileName = `${crypto.randomUUID()}${finalExt}`;
  const relativeDir = `${prefix}/${yyyy}/${mm}`;
  const absoluteDir = path.join(STORAGE_ROOT, relativeDir);

  ensureDir(absoluteDir);

  const publicBase = BASE_URL.replace(/\/$/, "");

  return {
    absolutePath: path.join(absoluteDir, fileName),
    publicUrl: `${publicBase}/storage/${relativeDir}/${fileName}`,
  };
}

function deleteLocalFile(fileUrl) {
  if (!fileUrl) return;

  try {
    const idx = String(fileUrl).indexOf("/storage/");
    if (idx === -1) return;

    const relative = String(fileUrl).slice(
      idx + "/storage/".length
    );

    if (!relative) return;

    const fullPath = path.join(STORAGE_ROOT, relative);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch {
    // silent fail
  }
}

function resolveLocalPathFromPublicUrl(fileUrl) {
  if (!fileUrl) return null;

  const idx = String(fileUrl).indexOf("/storage/");
  if (idx === -1) return null;

  const relative = String(fileUrl).slice(
    idx + "/storage/".length
  );

  if (!relative) return null;

  return path.join(STORAGE_ROOT, relative);
}

module.exports = {
  STORAGE_ROOT,
  buildLocalPath,
  deleteLocalFile,
  resolveLocalPathFromPublicUrl,
};