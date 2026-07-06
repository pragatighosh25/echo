import { Kafka, Producer, Consumer, Admin } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

const kafka = new Kafka({
  clientId: 'echo-backend',
  brokers: kafkaBrokers,
  retry: {
    initialRetryTime: 300,
    retries: 10, // Try up to 10 times to connect on startup
  },
});

let producer: Producer;
let consumer: Consumer;
let admin: Admin;

export const connectKafka = async () => {
  try {
    admin = kafka.admin();
    await admin.connect();
    console.log('Successfully connected Kafka Admin');

    // Pre-create topics if they do not exist
    const topicsToCreate = [
      'document.operations',
      'workspace.events',
      'notification.events',
      'task.events',
      'activity.events',
      'history.events',
    ];

    const existingTopics = await admin.listTopics();
    const newTopics = topicsToCreate
      .filter((topic) => !existingTopics.includes(topic))
      .map((topic) => ({ topic, numPartitions: 1 }));

    if (newTopics.length > 0) {
      await admin.createTopics({ topics: newTopics });
      console.log(`Created Kafka topics: ${newTopics.map((t) => t.topic).join(', ')}`);
    }
    await admin.disconnect();

    producer = kafka.producer();
    await producer.connect();
    console.log('Successfully connected Kafka Producer');

    consumer = kafka.consumer({ groupId: 'echo-backend-group' });
    await consumer.connect();
    console.log('Successfully connected Kafka Consumer');
  } catch (error) {
    console.error('Error connecting to Kafka:', error);
    // Do not fail hard, attempt to survive if Kafka is temporarily offline
  }
};

export const publishEvent = async (topic: string, key: string, payload: any) => {
  if (!producer) {
    console.warn(`Kafka producer not connected. Dropping message for topic ${topic}`);
    return;
  }
  try {
    await producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(payload),
        },
      ],
    });
  } catch (error) {
    console.error(`Error publishing event to Kafka topic ${topic}:`, error);
  }
};

export const subscribeToEvents = async (
  topic: string,
  callback: (key: string | null, payload: any) => Promise<void>
) => {
  if (!consumer) {
    console.warn(`Kafka consumer not connected. Unable to subscribe to ${topic}`);
    return;
  }
  try {
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const key = message.key ? message.key.toString() : null;
          const value = message.value ? JSON.parse(message.value.toString()) : null;
          await callback(key, value);
        } catch (err) {
          console.error(`Error processing Kafka message on topic ${topic}:`, err);
        }
      },
    });
    console.log(`Subscribed to Kafka topic: ${topic}`);
  } catch (error) {
    console.error(`Error subscribing to Kafka topic ${topic}:`, error);
  }
};
