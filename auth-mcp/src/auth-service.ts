import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  name: z.string().min(2),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer')
});

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: string;
}

export class AuthService {
  async login(email: string, password: string) {
    const user = await db.getUserByEmail(email);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Store session
    await db.createSession(user.id, token);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  async register(data: z.infer<typeof registerSchema>) {
    // Check if user exists
    const existing = await db.getUserByEmail(data.email);
    if (existing) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const userId = await db.createUser({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role || 'viewer'
    });

    // Get created user
    const user = await db.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Store session
    await db.createSession(user.id, token);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  async logout(token: string) {
    await db.deleteSession(token);
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      // Verify JWT
      const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
      
      // Check if session exists
      const session = await db.getSessionByToken(token);
      if (!session) {
        throw new Error('Session not found');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserFromToken(token: string) {
    const payload = await this.verifyToken(token);
    const user = await db.getUserById(payload.userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  private generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  }

  // Clean up expired sessions
  async cleanupSessions() {
    await db.deleteExpiredSessions();
  }
}

export const authService = new AuthService();