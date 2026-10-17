import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import rideRoutes from './routes/ride.routes'; // <-- Add this import
import { errorHandler, AppError } from './middlewares/error.middleware';

dotenv.config();

const app: Application = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rides', rideRoutes); // <-- Mount ride routes here

app.all('*', (req: Request, res: Response, next: NextFunction) => {
    next(new AppError(`Cannot find route ${req.originalUrl} on this server`, 404));
});

app.use(errorHandler);

export default app;