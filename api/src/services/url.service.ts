import { customAlphabet } from "nanoid";
import { prisma } from "../config/db";
import { getCachedUrl, setCachedUrl, deleteCachedUrl } from "../services/cache.service";
import { publishClickEvent } from "../config/kafka";

const generateShortCode = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  6
);


export async function createShortUrl(params: {
  originalUrl: string;
  userId: string;
  customAlias?: string;
  expiresAt?: Date;
}) {
  const shortCode = params.customAlias || generateShortCode();

  const url = await prisma.url.create({
    data: {
      shortCode,
      originalUrl: params.originalUrl,
      customAlias: params.customAlias || null,
      expiresAt: params.expiresAt || null,
      userId: params.userId,
    },
  });

  return url;
}

export async function resolveShortCode(
  shortCode: string,
  clickMeta: {
    ipAddress: string | null;
    userAgent: string | null;
    referer: string | null;
    country: string | null;
    deviceType: string | null;
  }
): Promise<{ originalUrl: string } | null> {
  let cached = await getCachedUrl(shortCode);

  if (!cached) {
    const url = await prisma.url.findUnique({
      where: { shortCode },
    });

    if (!url) return null;

    cached = {
      originalUrl: url.originalUrl,
      urlId: url.id,
      expiresAt: url.expiresAt?.toISOString() || null,
      isActive: url.isActive,
    };

    await setCachedUrl(shortCode, cached);
  }

  if (!cached.isActive) return null;
  if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
    await deleteCachedUrl(shortCode);
    return null;
  }

  publishClickEvent({
    urlId: cached.urlId,
    shortCode,
    clickedAt: new Date().toISOString(),
    ...clickMeta,
  }).catch((err) => {
    console.error("[Kafka] Failed to publish click event:", err.message);
  });

  return { originalUrl: cached.originalUrl };
}

export async function getUserUrls(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [urls, total] = await Promise.all([
    prisma.url.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        // Count clicks inline — no extra query needed
        _count: { select: { clicks: true } },
      },
    }),
    prisma.url.count({ where: { userId } }),
  ]);

  return { urls, total, page, limit };
}


export async function updateUrl(
  urlId: string,
  userId: string,
  data: { isActive?: boolean; customAlias?: string }
) {
  const url = await prisma.url.update({
    where: { id: urlId, userId }, // userId ensures ownership
    data,
  });

  await deleteCachedUrl(url.shortCode);
  return url;
}


export async function deleteUrl(urlId: string, userId: string) {
  const url = await prisma.url.update({
    where: { id: urlId, userId },
    data: { isActive: false },
  });

  await deleteCachedUrl(url.shortCode);
  return url;
}