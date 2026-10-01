import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../services/db.js';
import {
  generateToken,
  AuthRequest,
} from '../middleware/auth.js';

function normalizePhoneNumber(
  phone?: string
): string | undefined {
  if (!phone) {
    return undefined;
  }

  const cleaned = phone
    .trim()
    .replace(/[^\d+]/g, '');

  if (!cleaned) {
    return undefined;
  }

  if (cleaned.startsWith('+')) {
    return `+${cleaned
      .slice(1)
      .replace(/\D/g, '')}`;
  }

  return cleaned.replace(/\D/g, '');
}

// ============================================================
// REGISTER
// ============================================================

export async function register(
  req: Request,
  res: Response
) {
  try {
    const rawEmail = req.body.email;
    const rawName = req.body.name;
    const rawPhoneNumber = req.body.phoneNumber;
    const password = req.body.password;

    if (!rawEmail || !rawName || !password) {
      return res.status(400).json({
        error:
          'Name, email and password are required',
      });
    }

    const email = String(rawEmail)
      .trim()
      .toLowerCase();

    const name = String(rawName).trim();

    const phoneNumber = normalizePhoneNumber(
      rawPhoneNumber
        ? String(rawPhoneNumber)
        : undefined
    );

    if (name.length < 2) {
      return res.status(400).json({
        error: 'Name must contain at least 2 characters',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          'Password must contain at least 6 characters',
      });
    }

    if (phoneNumber) {
      const digitsOnly =
        phoneNumber.replace(/\D/g, '');

      if (digitsOnly.length < 7) {
        return res.status(400).json({
          error: 'Please enter a valid phone number',
        });
      }
    }

    const existingEmail =
      await db.getUserByEmail(email);

    if (existingEmail) {
      return res.status(409).json({
        error:
          'An account with this email already exists',
      });
    }

    if (phoneNumber) {
      const existingPhone =
        await db.getUserByPhone(phoneNumber);

      if (existingPhone) {
        return res.status(409).json({
          error:
            'An account with this phone number already exists',
        });
      }
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const user = await db.createUser({
      id: `user-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`,

      email,

      name,

      phoneNumber,

      passwordHash,

      avatarUrl:
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
          name
        )}`,
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const {
      passwordHash: _passwordHash,
      ...safeUser
    } = user;

    return res.status(201).json({
      user: safeUser,
      token,
    });
  } catch (error) {
    console.error(
      'Registration error:',
      error
    );

    return res.status(500).json({
      error:
        'Internal server error during registration',
    });
  }
}

// ============================================================
// LOGIN
// ============================================================

export async function login(
  req: Request,
  res: Response
) {
  try {
    const rawEmail = req.body.email;
    const password = req.body.password;

    if (!rawEmail || !password) {
      return res.status(400).json({
        error:
          'Email and password are required',
      });
    }

    const email = String(rawEmail)
      .trim()
      .toLowerCase();

    const user =
      await db.getUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        error:
          'Invalid email or password',
      });
    }

    const isMatch =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!isMatch) {
      return res.status(401).json({
        error:
          'Invalid email or password',
      });
    }

    await db.updateUserStatus(
      user.id,
      'online'
    );

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const {
      passwordHash: _passwordHash,
      ...safeUser
    } = user;

    return res.json({
      user: safeUser,
      token,
    });
  } catch (error) {
    console.error(
      'Login error:',
      error
    );

    return res.status(500).json({
      error:
        'Internal server error during login',
    });
  }
}

// ============================================================
// CURRENT USER
// ============================================================

export async function getMe(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const user =
      await db.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const {
      passwordHash: _passwordHash,
      ...safeUser
    } = user;

    return res.json({
      user: safeUser,
    });
  } catch (error) {
    console.error(
      'Get profile error:',
      error
    );

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}

// ============================================================
// ALL USERS
// ============================================================

export async function getAllUsers(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const users =
      await db.getUsers();

    const safeUsers = users.map(
      (user) => {
        const {
          passwordHash: _passwordHash,
          ...safeUser
        } = user;

        return safeUser;
      }
    );

    return res.json({
      users: safeUsers,
    });
  } catch (error) {
    console.error(
      'Get users error:',
      error
    );

    return res.status(500).json({
      error: 'Failed to fetch users',
    });
  }
}

// ============================================================
// FIND USER BY PHONE
// ============================================================

export async function findUserByPhone(
  req: AuthRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
      });
    }

    const rawPhone =
      req.query.phoneNumber;

    if (!rawPhone) {
      return res.status(400).json({
        error:
          'Phone number is required',
      });
    }

    const user =
      await db.getUserByPhone(
        String(rawPhone)
      );

    if (!user) {
      return res.status(404).json({
        error:
          'No ConnectX user found with this phone number',
      });
    }

    const {
      passwordHash: _passwordHash,
      ...safeUser
    } = user;

    return res.json({
      user: safeUser,
    });
  } catch (error) {
    console.error(
      'Phone lookup error:',
      error
    );

    return res.status(500).json({
      error:
        'Failed to search phone number',
    });
  }
}