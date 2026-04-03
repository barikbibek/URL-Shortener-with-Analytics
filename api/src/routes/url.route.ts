import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import UAParser from "ua-parser-js";
import { authenticateToken } from "../middleware/auth.mddleware";
import {
  createShortUrl,
  resolveShortCode,
  getUserUrls,
  updateUrl,
  deleteUrl,
} from "../services/url.service";

const router = Router();

const CreateUrlSchema = z.object({
  originalUrl: z.string().url("Must be a valid URL"),
  customAlias: z.string().min(3).max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

const UpdateUrlSchema = z.object({
  isActive: z.boolean().optional(),
  customAlias: z.string().min(3).max(50).optional(),
});

router.get(
  "/r/:shortCode",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { shortCode } = req.params;

      // Parse device type from User-Agent header
      const uaString = req.headers["user-agent"] || "";
      const ua = UAParser(uaString);
      const deviceType = ua.device.type || "desktop"; // "mobile" | "tablet" | undefined → "desktop"

      const ipAddress =
        (req.headers["x-real-ip"] as string) ||
        req.ip ||
        null;

      const result = await resolveShortCode(shortCode, {
        ipAddress,
        userAgent: uaString || null,
        referer: (req.headers["referer"] as string) || null,
        country: null, // Could integrate MaxMind GeoIP here later
        deviceType,
      });

      if (!result) {
        res.status(404).json({ error: "Short URL not found or expired" });
        return;
      }

      // 302 Found = temporary redirect (browser won't cache it permanently)
      // Use 301 only if the URL will never change — we use 302 so analytics work
      res.redirect(302, result.originalUrl);
    } catch (err) {
      next(err);
    }
  }
);


router.post(
  "/",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { originalUrl, customAlias, expiresAt } = CreateUrlSchema.parse(
        req.body
      );

      const url = await createShortUrl({
        originalUrl,
        userId: req.user!.userId,
        customAlias,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      const shortUrl = `${process.env.BASE_URL}/r/${url.shortCode}`;

      res.status(201).json({ url, shortUrl });
    } catch (err) {
      next(err);
    }
  }
);


router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await getUserUrls(req.user!.userId, page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);


router.patch(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateUrlSchema.parse(req.body);
      const url = await updateUrl(req.params.id, req.user!.userId, data);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);


router.delete(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteUrl(req.params.id, req.user!.userId);
      res.json({ message: "URL deactivated" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;