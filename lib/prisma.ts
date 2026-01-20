/**
 * Prisma Client Singleton
 *
 * Ensures only one instance of PrismaClient is created in development
 * to avoid connection pool exhaustion.
 */

import { PrismaClient } from '@prisma/client';
import { config } from './config';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Check if database is configured and available
 */
export function isDatabaseEnabled(): boolean {
  return config.database.enabled;
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    console.warn('[Database] DATABASE_URL not configured');
    return false;
  }

  try {
    await prisma.$connect();
    console.log('[Database] Connection successful');
    return true;
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    return false;
  }
}
