import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

// Connect to the DB when the app starts
export const connectDB = async () => {
  try {
    await db.$connect();
    console.log('Successfully connected to PostgreSQL');
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
    process.exit(1);
  }
};
