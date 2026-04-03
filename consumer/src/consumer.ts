// consumer/src/consumer.ts
//
// ─── HOW KAFKA CONSUMERS WORK ───────────────────────────────
//
// A Kafka topic is a log — an ordered sequence of messages.
// Each message has an OFFSET (a position number: 0, 1, 2, 3...).
//
// Your consumer reads messages one by one and tracks which
// offset it has processed. This is called "committing the offset".
//
// Why does this matter?
//   - If this consumer crashes at offset 500, when it restarts
//     it resumes from 500 — no data is lost.
//   - Multiple consumers in the same GROUP share the work.
//     Our group is "analytics-consumer-group".
//     If you ran 2 consumer instances, Kafka splits the 3
//     partitions between them (e.g. consumer A gets partitions
//     0,1 and consumer B gets partition 2).
//
// eachMessage vs eachBatch:
//   - eachMessage: called once per message, simpler to reason about
//   - eachBatch: called with a batch, higher throughput
//   We use eachMessage — clarity over micro-optimization here.
//
// autoCommit: false (we handle commits manually)
//   Why? If autoCommit is true and the consumer crashes AFTER
//   reading but BEFORE writing to Postgres, the offset is already
//   committed — that click is lost forever. With manual commit,
//   we only commit AFTER the DB write succeeds.
// ─────────────────────────────────────────────────────────────

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
  // If there's no committed offset for this group yet
  // (first ever run), start reading from the beginning
  // of the topic so no historical clicks are missed.
  // Change to "latest" if you only want new messages.
});

async function start(): Promise<void> {
  // ─────────────────────────────────────────────
  // RETRY LOGIC
  // Kafka might not be fully ready when this container
  // starts (even with healthcheck depends_on there's
  // sometimes a brief delay). Retry a few times before
  // giving up.
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // STEP 2: SUBSCRIBE TO TOPIC WITH RETRY
  //
  // Why retry here too?
  // Even after Kafka broker is healthy, the topic
  // "url-clicks" might not exist yet — it gets
  // auto-created when the API first publishes to it.
  // If the consumer tries to subscribe before the
  // topic exists, Kafka throws UNKNOWN_TOPIC_OR_PARTITION.
  //
  // Solution: keep retrying every 5 seconds until
  // the topic exists and subscription succeeds.
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // THE MAIN CONSUMER LOOP
  //
  // eachMessage is called for every message in order.
  // Kafka guarantees ordering within a partition.
  // (Our short_code key ensures same URL → same partition → ordered)
  //
  // Parameters:
  //   topic      — which topic this came from
  //   partition  — which partition (0, 1, or 2 for url-clicks)
  //   message    — the actual Kafka message
  //     .key     — Buffer containing the short_code
  //     .value   — Buffer containing the JSON payload
  //     .offset  — position of this message in the partition
  //
  // heartbeat() — tells Kafka "I'm still alive, don't reassign
  // my partitions to another consumer". Call it inside long-running
  // operations to prevent false timeouts.
  // ─────────────────────────────────────────────
  await consumer.run({
    // autoCommit: false = we manually commit after DB write succeeds
    // This is "at-least-once" delivery — if we crash after the DB
    // write but before commit, we'll re-process on restart (duplicate).
    // For analytics, a duplicate click is acceptable. For payments, you'd
    // use idempotency keys to deduplicate.
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
        // Parse the JSON payload the API sent
        const event = JSON.parse(rawValue) as ClickEvent;

        console.log(
          `[Consumer] Processing: ${event.event} | shortCode=${key} | offset=${offset} | partition=${partition}`
        );

        // Write to Postgres via the handler
        await handleClickEvent(event);

        // Tell Kafka "I've processed up to this offset"
        // resolveOffset adds 1 internally (commits the NEXT offset to read)
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
        // ─────────────────────────────────────────
        // ERROR HANDLING STRATEGY
        //
        // We log and skip bad messages rather than
        // crashing the consumer. Why?
        //   - If we throw here, kafkajs restarts the
        //     consumer loop, re-reads the same message,
        //     fails again → infinite loop.
        //   - Better to log it, skip it, and keep
        //     processing the rest of the queue.
        //
        // Production improvement: send failed messages
        // to a "dead letter topic" (url-clicks-failed)
        // so you can inspect and replay them later.
        // ─────────────────────────────────────────
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

// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN
//
// On SIGTERM (Docker stop), disconnect cleanly.
// Without this, Kafka thinks the consumer crashed
// and waits for a session timeout before reassigning
// partitions — adds unnecessary delay.
// ─────────────────────────────────────────────
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