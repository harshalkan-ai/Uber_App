import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import { errorHandler, AppError } from './middlewares/error.middleware';

dotenv.config();

const app: Application = express();

// 1. Global Middlewares
app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Health Check Endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// 3. API Route Registration
app.use('/api/v1/auth', authRoutes);

// 4. Catch-all for unhandled routes (404)
app.all('*', (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Cannot find route ${req.originalUrl} on this server`, 404));
});

// 5. Global Error Handling Middleware
app.use(errorHandler);

export default app;