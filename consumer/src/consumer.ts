import { Kafka, Consumer, logLevel } from "kafkajs";
import {
  handleClickEvent,
  disconnectPrisma,
  ClickEvent,
} from "./handlers/clickHandler";

const TOPIC = "url-clicks";
const GROUP_ID = process.env.KAFKA_GROUP_ID || "analytics-consumer-group";
const BROKER = process.env.KAFKA_BROKER || "localhost:9092";

const kafka = new Kafka({
  clientId: "url-shortener-consumer",
  brokers: [BROKER],
  logLevel: logLevel.ERROR,
});

const consumer: Consumer = kafka.consumer({
  groupId: GROUP_ID,

});

async function start(): Promise<void> {

  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      await consumer.connect();
      console.log("[Consumer] Connected to Kafka");
      break;
    } catch (err) {
      retries++;
      console.error(
        `[Consumer] Connection failed (attempt ${retries}/${maxRetries}):`,
        (err as Error).message
      );
      if (retries === maxRetries) {
        console.error("[Consumer] Max retries reached. Exiting.");
        process.exit(1);
      }
      // Wait 3 seconds before retrying
      await new Promise((r) => setTimeout(r, 3000));
    }
  }


  let subscribed = false;
  while (!subscribed) {
    try {
      await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
      subscribed = true;
      console.log(`[Consumer] Subscribed to topic: ${TOPIC}`);
    } catch (err) {
      console.log(
        `[Consumer] Topic "${TOPIC}" not ready yet, retrying in 5s...`
      );
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  await consumer.run({

    autoCommit: false,

    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const offset = message.offset;
      const key = message.key?.toString();
      const rawValue = message.value?.toString();

      if (!rawValue) {
        console.warn(`[Consumer] Empty message at offset ${offset} — skipping`);
        return;
      }

      try {
        const event = JSON.parse(rawValue) as ClickEvent;

        console.log(
          `[Consumer] Processing: ${event.event} | shortCode=${key} | offset=${offset} | partition=${partition}`
        );

        // Write to Postgres via the handler
        await handleClickEvent(event);

        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (BigInt(offset) + BigInt(1)).toString(),
          },
        ]);

        // Keep the Kafka session alive
        await heartbeat();

        console.log(`[Consumer] ✓ Committed offset ${offset}`);
      } catch (err) {
        
        console.error(
          `[Consumer] ✗ Failed to process offset ${offset}:`,
          (err as Error).message
        );
        console.error(`[Consumer] Raw message: ${rawValue}`);
        // Skip this message by committing its offset anyway
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (BigInt(offset) + BigInt(1)).toString(),
          },
        ]);
      }
    },
  });
}


async function shutdown(): Promise<void> {
  console.log("[Consumer] Shutting down...");
  await consumer.disconnect();
  await disconnectPrisma();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the consumer
start().catch((err) => {
  console.error("[Consumer] Fatal error:", err);
  process.exit(1);
});