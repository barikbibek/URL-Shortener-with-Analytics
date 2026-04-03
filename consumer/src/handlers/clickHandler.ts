import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ClickEvent {
  event: string;       // "url.clicked"
  urlId: string;
  shortCode: string;
  clickedAt: string;   // ISO string
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  deviceType: string | null;
}

export async function handleClickEvent(event: ClickEvent): Promise<void> {

  if (event.event !== "url.clicked") {
    console.warn(`[Consumer] Unknown event type: ${event.event} — skipping`);
    return;
  }

  await prisma.urlClick.create({
    data: {
      urlId: event.urlId,
      clickedAt: new Date(event.clickedAt),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      referer: event.referer,
      country: event.country,
      deviceType: event.deviceType,
    },
  });
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}