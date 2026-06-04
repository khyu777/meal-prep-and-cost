// Singleton wrapper for the Prisma client — import this instead of instantiating directly

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
