import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smartbearing_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, alertEmail } = req.body;
    
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
    
    const userRole = role === 'admin' ? 'admin' : 'operator';
    
    const newUser = new User({
      name,
      email,
      passwordHash,
      role: userRole,
      // Alerts default to the account email unless a separate one is given.
      alertEmail: alertEmail ? String(alertEmail).trim() : email,
    });
    await newUser.save();
    
    const token = jwt.sign({ id: newUser._id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    
    res.status(201).json({ success: true, data: { token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role, alertEmail: newUser.alertEmail } } });
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
    
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
    
    res.json({ success: true, data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update the signed-in user's alert email (Settings -> Notifications).
// Only whitelisted fields are accepted.
router.patch('/me', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { alertEmail } = req.body ?? {};
    const update: Record<string, string> = {};
    if (alertEmail !== undefined) update.alertEmail = String(alertEmail).trim();

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

export default router;
