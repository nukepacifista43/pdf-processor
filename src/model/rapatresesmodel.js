// src/models/rapatresesmodel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../utils/db");

const RapatReses = sequelize.define(
  "rapat_reses",
  {
    rapat_reses_id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    body_html: {
      type: DataTypes.TEXT("medium"),
      allowNull: true,
    },
    image_rapat_reses: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    pdf_rapat_reses: {
    type: DataTypes.STRING(2048),
    allowNull: true,
    },
    pdf_generated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    },
    pdf_source_updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
  },
  {
    tableName: "rapat_reses",
    timestamps: true,
    underscored: true,
  }
);

module.exports = RapatReses;
