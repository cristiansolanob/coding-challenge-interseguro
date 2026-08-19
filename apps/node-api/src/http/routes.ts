import { Router, type Request, type Response, type NextFunction } from 'express';
import { parseStatisticsRequest } from './dto';
import { poolStatistics } from '../stats/stats';
import { diagonalReport } from '../stats/diagonal';

export const router: Router = Router();

router.post('/api/v1/statistics', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matrix, q, r } = parseStatisticsRequest(req.body);

    const pool = poolStatistics([matrix, q, r]);
    const diagonal = diagonalReport(matrix, q, r);
    const isDiagonal = diagonal.matrix || diagonal.q || diagonal.r;

    res.status(200).json({
      count: pool.count,
      max: pool.max,
      min: pool.min,
      sum: pool.sum,
      average: pool.average,
      isDiagonal,
      diagonal,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});
