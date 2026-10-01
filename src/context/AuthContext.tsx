import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';

import { User } from '../types/index.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: User | null;

  token: string | null;

  isLoading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<void>;

  register: (
    name: string,
    email: string,
    password: string,
    phoneNumber?: string
  ) => Promise<void>;

  logout: () => void;

  switchDemoUser: (
    userNumber: 1 | 2 | 3
  ) => Promise<void>;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] =
    useState<User | null>(null);

  const [token, setToken] =
    useState<string | null>(
      localStorage.getItem(
        'connectx_token'
      )
    );

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res =
          await api.getMe();

        setUser(res.user);
      } catch (error) {
        console.warn(
          'Session expired or invalid token:',
          error
        );

        localStorage.removeItem(
          'connectx_token'
        );

        setToken(null);
        setUser(null);
      }

      setIsLoading(false);
    }

    loadUser();
  }, [token]);

  const login = async (
    email: string,
    password: string
  ) => {
    const res = await api.login({
      email,
      password,
    });

    localStorage.setItem(
      'connectx_token',
      res.token
    );

    setToken(res.token);
    setUser(res.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phoneNumber?: string
  ) => {
    const res =
      await api.register({
        name,
        email,
        password,
        phoneNumber,
      });

    localStorage.setItem(
      'connectx_token',
      res.token
    );

    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem(
      'connectx_token'
    );

    setToken(null);
    setUser(null);
  };

  const switchDemoUser = async (
    num: 1 | 2 | 3
  ) => {
    const demoAccounts = {
      1: {
        name: 'Elena Rostova (London, UK)',
        email: 'elena@connectx.corp',
        password: 'Password123!',
      },

      2: {
        name: 'Kenji Sato (Tokyo, JP)',
        email: 'kenji@connectx.corp',
        password: 'Password123!',
      },

      3: {
        name: 'Marcus Vance (New York, US)',
        email: 'marcus@connectx.corp',
        password: 'Password123!',
      },
    };

    const target =
      demoAccounts[num];

    try {
      await login(
        target.email,
        target.password
      );
    } catch {
      await register(
        target.name,
        target.email,
        target.password
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}