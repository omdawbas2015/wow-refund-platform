import jwt from 'jsonwebtoken';
export const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-refund-portal-secret');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export const authenticate = async (req: any, res: any, next: any) => {
  let token = '';
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const isAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

export const authenticateInternal = (req: any, res: any, next: any) => {
  const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!expectedSecret && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal webhook secret is not configured' });
  }

  if (!expectedSecret) return next();

  const providedSecret = req.headers['x-internal-secret'] || req.query.internalSecret;
  if (providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid internal webhook secret' });
  }

  next();
};

export const withErrorHandling = (fn: (req: any, res: any, next?: any) => Promise<any>) => 
  async (req: any, res: any, next?: any) => {
    try {
      return await fn(req, res, next);
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({
        success: false,
        error: err.message || "Internal Server Error"
      });
    }
  };
