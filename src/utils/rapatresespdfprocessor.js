// src/utils/pdfprocessor.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const MAX_FINAL_PDF_BYTES = 5 * 1024 * 1024;

function isPdfBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString() === "%PDF-";
}

function getBufferSizeBytes(buffer) {
  return Buffer.byteLength(buffer);
}

function getBufferSizeMB(buffer) {
  return getBufferSizeBytes(buffer) / (1024 * 1024);
}

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

async function compressPdfBuffer(buffer, preset = "/ebook") {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `${crypto.randomUUID()}-input.pdf`);
  const outputPath = path.join(tmpDir, `${crypto.randomUUID()}-output.pdf`);

  fs.writeFileSync(inputPath, buffer);

  try {
    const args = [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-dPDFSETTINGS=${preset}`,
      "-dDetectDuplicateImages=true",
      "-dCompressFonts=true",
      "-dSubsetFonts=true",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    await execFileAsync("gs", args);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Compressed PDF output not created");
    }

    return fs.readFileSync(outputPath);
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch {}
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

async function ensurePdfWithinLimit(buffer, maxBytes = MAX_FINAL_PDF_BYTES) {
  if (!isPdfBuffer(buffer)) {
    throw new Error("Uploaded file is not a valid PDF");
  }

  if (buffer.length <= maxBytes) {
    return { buffer, compressed: false, finalBytes: buffer.length };
  }

  const presets = ["/ebook", "/screen"];

  let best = buffer;

  for (const preset of presets) {
    try {
      const compressed = await compressPdfBuffer(buffer, preset);
      if (compressed.length < best.length) {
        best = compressed;
      }
      if (compressed.length <= maxBytes) {
        return {
          buffer: compressed,
          compressed: true,
          finalBytes: compressed.length,
        };
      }
    } catch {
      // continue trying next preset
    }
  }

  if (best.length <= maxBytes) {
    return {
      buffer: best,
      compressed: true,
      finalBytes: best.length,
    };
  }

  throw new Error("File terlalu besar meski sudah dikompresi");
}

module.exports = {
  MAX_FINAL_PDF_BYTES,
  isPdfBuffer,
  getBufferSizeBytes,
  getBufferSizeMB,
  compressPdfBuffer,
  ensurePdfWithinLimit,
};