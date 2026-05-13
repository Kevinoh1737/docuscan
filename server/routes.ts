import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import * as fs from "fs";
import * as path from "path";

function getBaseUrl(req: Request): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  const forwardedProto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("host") || req.header("x-forwarded-host") || "";
  return `${forwardedProto}://${host}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  app.get(/^\/public-objects\/(.*)/, async (req: Request, res: Response) => {
    const filePath = req.params[0] as string;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get(/^\/objects\/(.*)/, async (req: Request, res: Response) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      console.error("Error serving object:", error);
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (_req: Request, res: Response) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/submissions", async (req: Request, res: Response) => {
    try {
      const { name, phone, address, addressDetail, bankName, bankAccount, bankHolder } = req.body;
      if (!name || !phone || !address) {
        return res.status(400).json({ error: "Name, phone, and address are required" });
      }
      const submission = await storage.createSubmission({
        name,
        phone,
        address,
        addressDetail: addressDetail || null,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
        bankHolder: bankHolder || null,
      });
      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating submission:", error);
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  app.post("/api/submissions/:id/images", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { images } = req.body;

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Images array is required" });
      }

      const submission = await storage.getSubmission(id as string);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const savedImages = [];
      for (const img of images) {
        const objectPath = objectStorageService.normalizeObjectEntityPath(img.uploadUrl);

        const savedImage = await storage.addScannedImage({
          submissionId: id as string,
          documentType: img.documentType,
          imageUrl: objectPath,
          imageOrder: img.imageOrder || 0,
          fileName: img.fileName || null,
        });
        savedImages.push(savedImage);
      }

      await storage.updateSubmissionStatus(id as string, "submitted");
      res.status(201).json({ images: savedImages });
    } catch (error) {
      console.error("Error saving images:", error);
      res.status(500).json({ error: "Failed to save images" });
    }
  });

  app.get("/api/admin/submissions", async (_req: Request, res: Response) => {
    try {
      const allSubmissions = await storage.getAllSubmissions();
      res.json(allSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.get("/api/admin/submissions/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      const images = await storage.getImagesBySubmission(id as string);
      res.json({ ...submission, images });
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ error: "Failed to fetch submission" });
    }
  });

  app.put("/api/admin/submissions/:id/status", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const updated = await storage.updateSubmissionStatus(id as string, status);
      if (!updated) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.delete("/api/admin/submissions/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const deleted = await storage.deleteSubmission(id);
      if (!deleted) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting submission:", error);
      res.status(500).json({ error: "Failed to delete submission" });
    }
  });

  app.delete("/api/admin/submissions", async (_req: Request, res: Response) => {
    try {
      const count = await storage.deleteAllSubmissions();
      res.json({ success: true, deleted: count });
    } catch (error) {
      console.error("Error deleting all submissions:", error);
      res.status(500).json({ error: "Failed to delete submissions" });
    }
  });

  app.post("/api/vlm/forward/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { vlmServerUrl } = req.body;

      if (!vlmServerUrl) {
        return res.status(400).json({ error: "vlmServerUrl is required" });
      }

      const submission = await storage.getSubmission(id as string);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const images = await storage.getImagesBySubmission(id as string);

      const baseUrl = getBaseUrl(req);

      const payload = {
        submissionId: submission.id,
        userInfo: {
          name: submission.name,
          phone: submission.phone,
          address: submission.address,
          addressDetail: submission.addressDetail,
        },
        documents: images.map((img) => ({
          id: img.id,
          documentType: img.documentType,
          imageUrl: `${baseUrl}${img.imageUrl}`,
          imageOrder: img.imageOrder,
        })),
        submittedAt: submission.createdAt,
      };

      const vlmResponse = await fetch(vlmServerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!vlmResponse.ok) {
        const errorText = await vlmResponse.text();
        return res.status(502).json({
          error: "VLM server returned an error",
          status: vlmResponse.status,
          details: errorText,
        });
      }

      const vlmResult = await vlmResponse.json();
      await storage.updateSubmissionStatus(id as string, "forwarded");
      res.json({ success: true, vlmResponse: vlmResult });
    } catch (error) {
      console.error("Error forwarding to VLM:", error);
      res.status(500).json({ error: "Failed to forward to VLM server" });
    }
  });

  app.get("/admin", (_req: Request, res: Response) => {
    const templatePath = path.resolve(
      process.cwd(),
      "server",
      "templates",
      "admin.html",
    );
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send("Admin page not found");
    }
    const html = fs.readFileSync(templatePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  });

  const httpServer = createServer(app);
  return httpServer;
}
