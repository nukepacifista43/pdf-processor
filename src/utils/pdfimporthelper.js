// src/utils/pdfimporthelper.js
const { PDFParse } = require("pdf-parse");

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToDraftHtml(rawText, title = "Imported PDF Draft") {
  const normalized = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  const blocks = normalized
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);

  const body = blocks.length
    ? blocks
        .map((block) => {
          const lines = block
            .split("\n")
            .map((line) => escapeHtml(line.trim()))
            .filter(Boolean);

          if (!lines.length) return "";

          return `<p>${lines.join("<br />")}</p>`;
        })
        .join("\n")
    : "<p></p>";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      line-height: 1.6;
      padding: 24px;
    }
    h1 { margin-bottom: 16px; }
    p { margin: 0 0 14px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;
}

async function importPdfBufferToDraftHtml(buffer, title) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    const rawText = result?.text || "";

    return {
      rawText,
      draftHtml: textToDraftHtml(rawText, title),
      meta: {
        pages: result?.total ?? null,
        info: result?.info ?? null,
      },
    };
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  importPdfBufferToDraftHtml,
  textToDraftHtml,
};