import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticateJWT, AuthRequest, requireRoles } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smartbearing_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function publicUser(user: any) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    factoryUnits: user.factoryUnits ?? [],
    customerName: user.customerName || undefined,
    alertEmail: user.alertEmail,
    alertWhatsapp: user.alertWhatsapp,
  };
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, alertEmail } = req.body;
    
    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required' });
      return;
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ success: false, error: 'User already exists' });
      return;
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser = new User({
      name,
      email,
      passwordHash,
      // Public registration creates a least-privilege worker account. Role and
      // factory access are provisioned by an administrator after verification.
      role: 'worker',
      factoryUnits: [],
      // Alerts default to the account email unless a separate one is given.
      alertEmail: alertEmail ? String(alertEmail).trim() : email,
    });
    await newUser.save();
    
    const token = jwt.sign({ id: newUser._id, email: newUser.email, role: newUser.role, factoryUnits: newUser.factoryUnits, customerName: newUser.customerName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    
    res.status(201).json({ success: true, data: { token, user: publicUser(newUser) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role, factoryUnits: user.factoryUnits, customerName: user.customerName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    
    res.json({ success: true, data: { token, user: publicUser(user) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update the signed-in user's alert email (Settings -> Notifications).
// Only whitelisted fields are accepted.
router.patch('/me', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { alertEmail, alertWhatsapp } = req.body ?? {};
    const update: Record<string, string> = {};
    if (alertEmail !== undefined) update.alertEmail = String(alertEmail).trim();
    if (alertWhatsapp !== undefined) update.alertWhatsapp = String(alertWhatsapp).trim();

    if (Object.keys(update).length === 0) {
      res.status(400).json({ success: false, error: 'Nothing to update' });
      return;
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users', authenticateJWT, requireRoles('maintenance_engineer', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/users/:id/role', authenticateJWT, requireRoles('maintenance_engineer', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedRoles = ['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'customer', 'operator'];
    const { role, factoryUnits, customerName } = req.body ?? {};
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (factoryUnits !== undefined && (!Array.isArray(factoryUnits) || factoryUnits.some((unit: unknown) => typeof unit !== 'string'))) {
      res.status(400).json({ success: false, error: 'factoryUnits must be an array of strings' });
      return;
    }
    const update: Record<string, unknown> = { role };
    if (factoryUnits !== undefined) update.factoryUnits = [...new Set(factoryUnits)];
    if (customerName !== undefined) update.customerName = String(customerName).trim();
    const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select('-passwordHash').lean();
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
