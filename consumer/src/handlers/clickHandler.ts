// consumer/src/handlers/clickHandler.ts
//
// Single responsibility: take a parsed click event
// and write it to the url_clicks table in Postgres.
//
// This is called by consumer.ts for every Kafka message.
// Keeping it in its own file makes it easy to test in
// isolation — you can unit test this without running Kafka.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// This shape must match the JSON payload the API produces
// in kafka.ts → publishClickEvent()
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
  // Verify this is the event type we expect
  // In future you might have other event types on this topic
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