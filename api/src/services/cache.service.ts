import { redis } from "../config/redis";

interface CachedUrl {
  originalUrl: string;
  urlId: string;
  expiresAt: string | null;
  isActive: boolean;
}

const TTL = 86400

export const getCachedUrl = async (shortCode: string): Promise<CachedUrl | null > => {
    const data = await redis.get(`url:${shortCode}`)
    if(!data) return null
    // reset TTL on every hit
    await redis.expire(`url:${shortCode}`, TTL)
    return JSON.parse(data)
}

export const setCachedUrl = async (shortCode: string, value: CachedUrl): Promise<void> => {
    await redis.setEx(`url:${shortCode}`, TTL, JSON.stringify(value))
}

export const deleteCachedUrl = async (shortCode: string): Promise<void> => {
    await redis.del(`url:${shortCode}`)
}