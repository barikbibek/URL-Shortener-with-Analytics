import { Router, Request, Response, NextFunction } from "express";
import {prisma} from "../config/db";
import { authenticateToken } from "../middleware/auth.mddleware";

const router = Router();

async function verifyUrlOwnership(
  urlId: string,
  userId: string
): Promise<boolean> {
  const url = await prisma.url.findFirst({ where: { id: urlId, userId } });
  return !!url;
}

// GET /api/analytics/:urlId/summary
// Total clicks, unique IPs, top countries, top devices

router.get(
  "/:urlId/summary",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { urlId } = req.params;

      if (!(await verifyUrlOwnership(urlId, req.user!.userId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const [totalClicks, uniqueIps, topCountries, topDevices] =
        await Promise.all([
          // Total clicks count
          prisma.urlClick.count({ where: { urlId } }),

          // Count distinct IP addresses
          prisma.urlClick.findMany({
            where: { urlId, ipAddress: { not: null } },
            select: { ipAddress: true },
            distinct: ["ipAddress"],
          }),

          // Group by country, sorted by count descending
          prisma.urlClick.groupBy({
            by: ["country"],
            where: { urlId, country: { not: null } },
            _count: { country: true },
            orderBy: { _count: { country: "desc" } },
            take: 5,
          }),

          // Group by device type
          prisma.urlClick.groupBy({
            by: ["deviceType"],
            where: { urlId, deviceType: { not: null } },
            _count: { deviceType: true },
            orderBy: { _count: { deviceType: "desc" } },
          }),
        ]);

      res.json({
        totalClicks,
        uniqueVisitors: uniqueIps.length,
        topCountries: topCountries.map((c: any) => ({
          country: c.country,
          clicks: c._count.country,
        })),
        topDevices: topDevices.map((d: any) => ({
          device: d.deviceType,
          clicks: d._count.deviceType,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/:urlId/timeline
// Clicks grouped by day. Query: ?from=2024-01-01&to=2024-12-31
//
// Uses raw SQL for DATE_TRUNC because Prisma's groupBy doesn't
// support date truncation natively.

router.get(
  "/:urlId/timeline",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { urlId } = req.params;

      if (!(await verifyUrlOwnership(urlId, req.user!.userId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const from = req.query.from
        ? new Date(req.query.from as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to
        ? new Date(req.query.to as string)
        : new Date();

      // Use groupBy instead of raw SQL to avoid BigInt serialization issues
      const clicks = await prisma.urlClick.findMany({
        where: {
          urlId,
          clickedAt: { gte: from, lte: to },
        },
        select: { clickedAt: true },
        orderBy: { clickedAt: "asc" },
      });

      // Group by day in JavaScript
      const grouped: Record<string, number> = {};
      for (const click of clicks) {
        const date = click.clickedAt.toISOString().split("T")[0];
        grouped[date] = (grouped[date] || 0) + 1;
      }

      const timeline = Object.entries(grouped).map(([date, clicks]) => ({
        date,
        clicks,
      }));

      res.json({ timeline });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/:urlId/geo
router.get(
  "/:urlId/geo",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { urlId } = req.params;

      if (!(await verifyUrlOwnership(urlId, req.user!.userId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const geo = await prisma.urlClick.groupBy({
        by: ["country"],
        where: { urlId, country: { not: null } },
        _count: { country: true },
        orderBy: { _count: { country: "desc" } },
      });

      res.json({
        geo: geo.map((g: any) => ({ country: g.country, clicks: g._count.country })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/analytics/:urlId/devices

router.get(
  "/:urlId/devices",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { urlId } = req.params;

      if (!(await verifyUrlOwnership(urlId, req.user!.userId))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const devices = await prisma.urlClick.groupBy({
        by: ["deviceType"],
        where: { urlId, deviceType: { not: null } },
        _count: { deviceType: true },
        orderBy: { _count: { deviceType: "desc" } },
      });

      res.json({
        devices: devices.map((d: any) => ({
          device: d.deviceType,
          clicks: d._count.deviceType,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;