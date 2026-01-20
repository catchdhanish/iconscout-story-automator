/**
 * Prisma Client Singleton
 *
 * Ensures only one instance of PrismaClient is created in development
 * to avoid connection pool exhaustion.
 *
 * IMPORTANT: Prisma is optional. If DATABASE_URL is not configured,
 * the app will still run (using history.json as fallback).
 */

import { PrismaClient } from '@prisma/client';
import { config } from './config';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more:
// https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient | null };

/**
 * Lazy-initialized Prisma Client
 * Only creates PrismaClient if DATABASE_URL is configured
 */
let _prisma: PrismaClient | null = null;

export const prisma: PrismaClient | null = (() => {
  // Don't create PrismaClient if DATABASE_URL is not configured
  if (!config.database.enabled) {
    console.warn('[Prisma] DATABASE_URL not configured, database features disabled');
    return null;
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  try {
    _prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma;
    }

    return _prisma;
  } catch (error) {
    console.error('[Prisma] Failed to initialize PrismaClient:', error);
    return null;
  }
})();

/**
 * Check if database is configured and available
 */
export function isDatabaseEnabled(): boolean {
  return config.database.enabled && prisma !== null;
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  if (!isDatabaseEnabled() || !prisma) {
    console.warn('[Database] DATABASE_URL not configured or Prisma client unavailable');
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
