// Express application entry point — registers middleware, mounts routers, starts the server

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';
import ingredientsRouter from './routes/ingredients';
import mealsRouter from './routes/meals';
import plansRouter from './routes/plans';

const app = express();
const PORT = process.env.PORT ?? 3002;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '10kb' }));
app.use(requestLogger);

app.use('/api/ingredients', ingredientsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/plans', plansRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler — must be last
app.use(errorHandler);

// Only bind a port when run directly — tests import the app without starting a server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
