const sharp = require("sharp");

async function processImage(buffer) {
  return sharp(buffer)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

module.exports = { processImage };
