import { Kafka, Producer } from "kafkajs";

interface Payload {
  urlId: string;
  shortCode: string;
  clickedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string | null;
  deviceType: string | null;
}

const kafka = new Kafka({
    clientId: "api-service",
    brokers: [process.env.KAFKA_BROKER!]
})

const producer: Producer = kafka.producer()

export async function connectProducer(): Promise<void> {
    await producer.connect()
    console.log("kafka producer connected");
}

export async function disconnectProducer(): Promise<void> {
    await producer.disconnect()
}

// publishClickEvent
//  Sends one message to the "url-clicks" topic.

export async function publishClickEvent(payload: Payload): Promise<void> {
    await producer.send({
        topic: "url-clicks",
        messages: [{
            key: payload.shortCode,
            value: JSON.stringify({
                event: "url.clicked",
                ...payload,
            })
        }]
    })
}

export default kafka;