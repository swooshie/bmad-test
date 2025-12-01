import { Schema, model, models } from "mongoose";

export type ColumnDataType = "string" | "number" | "boolean" | "date" | "null" | "unknown";

export interface ColumnDefinitionAttributes {
  sheetId: string;
  columnKey: string;
  label: string;
  displayOrder: number;
  dataType: ColumnDataType;
  nullable: boolean;
  detectedAt: Date;
  lastSeenAt: Date;
  removedAt?: Date | null;
  sourceVersion: string;
}

const columnDefinitionSchema = new Schema<ColumnDefinitionAttributes>(
  {
    sheetId: { type: String, required: true, trim: true },
    columnKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true },
    dataType: {
      type: String,
      enum: ["string", "number", "boolean", "date", "null", "unknown"],
      default: "unknown",
    },
    nullable: { type: Boolean, default: true },
    detectedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    removedAt: { type: Date, default: null },
    sourceVersion: { type: String, required: true, trim: true },
  },
  {
    collection: "column_definitions",
    timestamps: false,
  }
);

columnDefinitionSchema.index({ sheetId: 1, columnKey: 1 }, { unique: true });
columnDefinitionSchema.index({ sheetId: 1, removedAt: 1 });

export const ColumnDefinitionModel =
  models.ColumnDefinition || model<ColumnDefinitionAttributes>("ColumnDefinition", columnDefinitionSchema);

export default ColumnDefinitionModel;
