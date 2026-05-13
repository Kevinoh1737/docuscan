import { Response } from "express";
import { randomUUID } from "crypto";
import { s3Client } from "../lib/s3";
import { GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.R2_BUCKET_NAME || "docscan";
  }

  getPublicObjectSearchPaths(): Array<string> {
    return [this.bucketName];
  }

  getPrivateObjectDir(): string {
    return "private";
  }

  async searchPublicObject(filePath: string): Promise<string | null> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `public/${filePath}`,
        MaxKeys: 1,
      });
      const response = await s3Client.send(command);
      if (!response.Contents || response.Contents.length === 0) {
        return null;
      }
      return `public/${filePath}`;
    } catch (error) {
      console.error("Error searching public object:", error);
      return null;
    }
  }

  async downloadObject(objectPath: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectPath,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new ObjectNotFoundError();
      }

      res.set({
        "Content-Type": response.ContentType || "application/octet-stream",
        "Content-Length": response.ContentLength?.toString() || "0",
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      // Stream the body to the response
      const stream = response.Body as any;
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const filePath = `private/uploads/${objectId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 900 });
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }
    const entityId = parts.slice(1).join("/");
    return `private/${entityId}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("http")) {
      try {
        const url = new URL(rawPath);
        // S3 signed URLs often have the path in the pathname
        const pathParts = url.pathname.split("/");
        // Look for "private/" in the path
        const privateIndex = pathParts.findIndex(p => p === "private");
        if (privateIndex !== -1) {
          const relativePath = pathParts.slice(privateIndex + 1).join("/");
          return `/objects/${relativePath}`;
        }
      } catch (e) {
        return rawPath;
      }
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: any
  ): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity({
    userId,
    objectPath,
  }: {
    userId?: string;
    objectPath: string;
  }): Promise<boolean> {
    if (objectPath.startsWith("private/")) {
      return !!userId;
    }
    return true;
  }
}
