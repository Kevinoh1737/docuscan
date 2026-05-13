import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const submissions = pgTable("submissions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  addressDetail: text("address_detail"),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankHolder: text("bank_holder"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scannedImages = pgTable("scanned_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id")
    .notNull()
    .references(() => submissions.id),
  documentType: text("document_type").notNull(),
  imageUrl: text("image_url").notNull(),
  imageOrder: integer("image_order").notNull().default(0),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissionsRelations = relations(submissions, ({ many }) => ({
  images: many(scannedImages),
}));

export const scannedImagesRelations = relations(scannedImages, ({ one }) => ({
  submission: one(submissions, {
    fields: [scannedImages.submissionId],
    references: [submissions.id],
  }),
}));

export const insertSubmissionSchema = createInsertSchema(submissions).pick({
  name: true,
  phone: true,
  address: true,
  addressDetail: true,
  bankName: true,
  bankAccount: true,
  bankHolder: true,
});

export const insertScannedImageSchema = createInsertSchema(scannedImages).pick({
  submissionId: true,
  documentType: true,
  imageUrl: true,
  imageOrder: true,
  fileName: true,
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type ScannedImage = typeof scannedImages.$inferSelect;
export type InsertScannedImage = z.infer<typeof insertScannedImageSchema>;
