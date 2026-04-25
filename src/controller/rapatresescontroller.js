// src/controllers/rapatresescontroller.js
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const RapatReses = require("../models/rapatresesmodel");
const {
  buildLocalPath,
  deleteLocalFile,
  resolveLocalPathFromPublicUrl,
} = require("../utils/localstoragehelper");
const { processImage } = require("../utils/imageprocessor");
const {
  isPdfBuffer,
  ensurePdfWithinLimit,
  MAX_FINAL_PDF_BYTES,
  getBufferSizeBytes
} = require("../utils/rapatresespdfprocessor");
const {
  importPdfBufferToDraftHtml,
} = require("../utils/pdfimporthelper");

const allowedStatus = new Set(["draft", "published", "archived"]);
const MAX_BODY_HTML_BYTES = 5 * 1024 * 1024;

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ensureFullHtmlDocument(html) {
  const s = String(html || "").trim();
  if (!s) return "";
  const hasHtmlTag = /<html[\s>]/i.test(s);
  const hasBodyTag = /<body[\s>]/i.test(s);
  const hasDoctype = /<!doctype html>/i.test(s);

  if (hasHtmlTag || hasBodyTag || hasDoctype) return s;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rapat Reses</title>
</head>
<body>
${s}
</body>
</html>`;
}

function validateBodyHtml(bodyHtml) {
  if (bodyHtml === undefined || bodyHtml === null) return;

  const bytes = Buffer.byteLength(String(bodyHtml), "utf8");
  if (bytes > MAX_BODY_HTML_BYTES) {
    throw new Error("body_html exceeds 5 MB limit");
  }

  if (/data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(String(bodyHtml))) {
    throw new Error(
      "body_html must not contain inline base64 images. Upload images separately and use URLs."
    );
  }
}

// ================= CREATE =================
exports.createRapatReses = async (req, res) => {
  try {
    const { title, description, body_html, status } = req.body;
    const file = req.file;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        error: "title is required",
      });
    }

    if (!status || !allowedStatus.has(status)) {
      return res.status(400).json({
        success: false,
        error: "status must be one of: draft, published, archived",
      });
    }

    validateBodyHtml(body_html);

    let image_rapat_reses = null;

    if (file) {
      const processed = await processImage(file.buffer);
      const { absolutePath, publicUrl } = buildLocalPath(
        "rapat_reses",
        file.originalname
      );

      fs.writeFileSync(absolutePath, processed);
      image_rapat_reses = publicUrl;
    } else if (req.body.image_rapat_reses) {
      image_rapat_reses = req.body.image_rapat_reses;
    }

    const created = await RapatReses.create({
      title: title.trim(),
      description: description?.trim() ?? null,
      body_html: body_html ?? null,
      image_rapat_reses,
      status,
      pdf_source_updated_at: body_html ? new Date() : null,
    });

    return res.status(201).json({
      success: true,
      message: "Rapat reses created",
      data: created,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Create rapat reses failed",
      error: error.message,
    });
  }
};

// ================= READ =================
exports.getRapatReses = async (_, res) => {
  try {
    const rows = await RapatReses.findAll({
      order: [["created_at", "ASC"]],
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.getRapatResesById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ================= UPDATE =================
exports.updateRapatResesById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const { title, description, body_html, status } = req.body;
    const file = req.file;

    if (status && !allowedStatus.has(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    if (body_html !== undefined) {
      validateBodyHtml(body_html);
    }

    if (file) {
      if (row.image_rapat_reses) {
        deleteLocalFile(row.image_rapat_reses);
      }

      const processed = await processImage(file.buffer);
      const { absolutePath, publicUrl } = buildLocalPath(
        "rapat_reses",
        file.originalname
      );

      fs.writeFileSync(absolutePath, processed);
      row.image_rapat_reses = publicUrl;
    }

    let bodyChanged = false;

    if (title !== undefined) row.title = title.trim();
    if (description !== undefined) row.description = description?.trim() ?? null;

    if (body_html !== undefined) {
      const oldBody = row.body_html ?? "";
      const newBody = body_html ?? "";
      bodyChanged = String(oldBody) !== String(newBody);
      row.body_html = body_html;
    }

    if (status !== undefined) row.status = status;

    if (req.body.image_rapat_reses !== undefined) {
      row.image_rapat_reses = req.body.image_rapat_reses || null;
    }

    // RESET PDF ONLY IF body_html changed
    if (bodyChanged) {
      if (row.pdf_rapat_reses) {
        deleteLocalFile(row.pdf_rapat_reses);
      }

      row.pdf_rapat_reses = null;
      row.pdf_generated_at = null;
      row.pdf_source_updated_at = new Date();
    }

    await row.save();

    return res.json({
      success: true,
      message: "Updated",
      data: row,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ================= DELETE =================
exports.deleteRapatResesById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (row.image_rapat_reses) deleteLocalFile(row.image_rapat_reses);
    if (row.pdf_rapat_reses) deleteLocalFile(row.pdf_rapat_reses);

    await row.destroy();

    return res.json({
      success: true,
      message: "Deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ================= DELETE IMAGE ONLY =================
exports.deleteRapatResesImage = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (row.image_rapat_reses) {
      deleteLocalFile(row.image_rapat_reses);
      row.image_rapat_reses = null;
      await row.save();
    }

    return res.json({
      success: true,
      message: "Image deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ================= UPLOAD EDITOR IMAGE =================
exports.uploadRapatResesImage = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "image_file is required",
      });
    }

    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed",
      });
    }

    const processed = await processImage(file.buffer);

    const { absolutePath, publicUrl } = buildLocalPath(
      "rapat_reses_editor",
      file.originalname
    );

    fs.writeFileSync(absolutePath, processed);

    return res.status(201).json({
      success: true,
      message: "Image uploaded",
      data: {
        image_url: publicUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Upload image failed",
      error: error.message,
    });
  }
};

// ================= GENERATE PDF =================
exports.generateRapatResesPdfById = async (req, res) => {
  let browser = null;

  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!row.body_html || !String(row.body_html).trim()) {
      return res.status(400).json({
        success: false,
        message:
          "body_html is empty. Frontend must provide full HTML content before generating PDF.",
      });
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const html = ensureFullHtmlDocument(row.body_html);

    await page.setContent(html, { waitUntil: "networkidle0" });

    // 1) Generate dulu ke BUFFER, bukan langsung ke file
    const generatedPdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });

    let finalPdfBuffer = generatedPdfBuffer;
    let compressed = false;

    // 2) Kompres HANYA kalau > 5 MB
    if (getBufferSizeBytes(generatedPdfBuffer) > MAX_FINAL_PDF_BYTES) {
      const ensured = await ensurePdfWithinLimit(
        generatedPdfBuffer,
        MAX_FINAL_PDF_BYTES
      );

      finalPdfBuffer = ensured.buffer;
      compressed = ensured.compressed;
    }

    // 3) Hapus PDF lama kalau ada
    if (row.pdf_rapat_reses) {
      deleteLocalFile(row.pdf_rapat_reses);
    }

    // 4) Simpan hasil akhir ke storage
    const { absolutePath, publicUrl } = buildLocalPath(
      "rapat_reses_pdf",
      `${row.rapat_reses_id}.pdf`,
      { forceExt: ".pdf" }
    );

    fs.writeFileSync(absolutePath, finalPdfBuffer);

    row.pdf_rapat_reses = publicUrl;
    row.pdf_generated_at = new Date();
    await row.save();

    return res.json({
      success: true,
      message: compressed
        ? "PDF generated and compressed"
        : "PDF generated",
      data: {
        rapat_reses_id: row.rapat_reses_id,
        pdf_rapat_reses: row.pdf_rapat_reses,
        pdf_generated_at: row.pdf_generated_at,
        pdf_source_updated_at: row.pdf_source_updated_at,
        final_size_bytes: getBufferSizeBytes(finalPdfBuffer),
        compressed,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Generate PDF failed",
      error: error.message,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
};

// ================= DOWNLOAD PDF =================
exports.downloadRapatResesPdfById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!row.pdf_rapat_reses) {
      return res.status(404).json({
        success: false,
        message: "PDF not generated yet. Generate it first.",
      });
    }

    const fullPath = resolveLocalPathFromPublicUrl(row.pdf_rapat_reses);
    if (!fullPath) {
      return res.status(500).json({
        success: false,
        message: "Invalid pdf_rapat_reses URL format",
      });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        success: false,
        message: "PDF file missing on server",
      });
    }

    const safeName = `${slugify(row.title || "rapat-reses")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"`
    );

    return res.sendFile(fullPath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Download PDF failed",
      error: error.message,
    });
  }
};

// ================= UPLOAD PDF MANUAL =================
exports.uploadRapatResesPdfById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "pdf_file is required",
      });
    }

    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed",
      });
    }

    if (!isPdfBuffer(file.buffer)) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is not a valid PDF",
      });
    }

    const ensured = await ensurePdfWithinLimit(
      file.buffer,
      MAX_FINAL_PDF_BYTES
    );

    if (row.pdf_rapat_reses) {
      deleteLocalFile(row.pdf_rapat_reses);
    }

    const { absolutePath, publicUrl } = buildLocalPath(
      "rapat_reses_pdf",
      file,
      { forceExt: ".pdf", keepOriginalExt: true }
    );

    fs.writeFileSync(absolutePath, ensured.buffer);

    row.pdf_rapat_reses = publicUrl;
    row.pdf_generated_at = new Date();
    await row.save();

    return res.json({
      success: true,
      message: ensured.compressed
        ? "PDF uploaded and compressed"
        : "PDF uploaded",
      data: {
        rapat_reses_id: row.rapat_reses_id,
        pdf_rapat_reses: row.pdf_rapat_reses,
        pdf_generated_at: row.pdf_generated_at,
        final_size_bytes: ensured.finalBytes,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Upload PDF failed",
      error: error.message,
    });
  }
};

// ================= IMPORT PDF TO EDITABLE DRAFT =================
exports.importRapatResesPdfToHtmlById = async (req, res) => {
  try {
    const row = await RapatReses.findByPk(req.params.rapat_reses_id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "pdf_file is required",
      });
    }

    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed",
      });
    }

    if (!isPdfBuffer(file.buffer)) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is not a valid PDF",
      });
    }

    const imported = await importPdfBufferToDraftHtml(
      file.buffer,
      row.title || "Imported PDF Draft"
    );

    // tidak langsung overwrite body_html
    return res.json({
      success: true,
      message:
        "PDF imported to editable draft HTML. Review and save it via update endpoint.",
      data: {
        rapat_reses_id: row.rapat_reses_id,
        draft_html: imported.draftHtml,
        raw_text_preview: imported.rawText.slice(0, 2000),
        meta: imported.meta,
        note:
          "This is a draft import. Complex layouts, scanned PDFs, and images may require manual cleanup in the editor.",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Import PDF to draft HTML failed",
      error: error.message,
    });
  }
};