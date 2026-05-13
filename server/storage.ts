import {
  submissions,
  scannedImages,
  type Submission,
  type InsertSubmission,
  type ScannedImage,
  type InsertScannedImage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createSubmission(data: InsertSubmission): Promise<Submission>;
  getSubmission(id: string): Promise<Submission | undefined>;
  getAllSubmissions(): Promise<Submission[]>;
  updateSubmissionStatus(id: string, status: string): Promise<Submission | undefined>;
  deleteSubmission(id: string): Promise<boolean>;
  deleteAllSubmissions(): Promise<number>;
  addScannedImage(data: InsertScannedImage): Promise<ScannedImage>;
  getImagesBySubmission(submissionId: string): Promise<ScannedImage[]>;
}

export class DatabaseStorage implements IStorage {
  async createSubmission(data: InsertSubmission): Promise<Submission> {
    const [submission] = await db
      .insert(submissions)
      .values(data)
      .returning();
    return submission;
  }

  async getSubmission(id: string): Promise<Submission | undefined> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id));
    return submission || undefined;
  }

  async getAllSubmissions(): Promise<Submission[]> {
    return db
      .select()
      .from(submissions)
      .orderBy(desc(submissions.createdAt));
  }

  async updateSubmissionStatus(id: string, status: string): Promise<Submission | undefined> {
    const [submission] = await db
      .update(submissions)
      .set({ status, updatedAt: new Date() })
      .where(eq(submissions.id, id))
      .returning();
    return submission || undefined;
  }

  async deleteSubmission(id: string): Promise<boolean> {
    await db.delete(scannedImages).where(eq(scannedImages.submissionId, id));
    const result = await db.delete(submissions).where(eq(submissions.id, id)).returning();
    return result.length > 0;
  }

  async deleteAllSubmissions(): Promise<number> {
    await db.delete(scannedImages);
    const result = await db.delete(submissions).returning();
    return result.length;
  }

  async addScannedImage(data: InsertScannedImage): Promise<ScannedImage> {
    const [image] = await db
      .insert(scannedImages)
      .values(data)
      .returning();
    return image;
  }

  async getImagesBySubmission(submissionId: string): Promise<ScannedImage[]> {
    return db
      .select()
      .from(scannedImages)
      .where(eq(scannedImages.submissionId, submissionId));
  }
}

export const storage = new DatabaseStorage();
