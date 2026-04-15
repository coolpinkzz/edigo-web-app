import mongoose from 'mongoose';
import { env } from '../config/env';

const connectionOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10,
};

/**
 * Connects to MongoDB using the URI from environment config.
 */
export async function connectDB(): Promise<void> {
  if (!env.mongoUri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  try {
    await mongoose.connect(env.mongoUri, connectionOptions);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

/**
 * Graceful disconnect. Call before process exit.
 */
export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnect error:', error);
  }
}

// Event handlers
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});
