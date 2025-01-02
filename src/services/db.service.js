const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Test connection
prisma
  .$connect()
  .then(() => console.log('Database connected'))
  .catch((err) => console.error('Database connection error:', err));

module.exports = prisma;
