import React, { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext.js';

import {
  Globe,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Database,
  MapPin,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { login, register, switchDemoUser } = useAuth();

  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberCredentials, setRememberCredentials] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // --------------------------------------------------
  // RESTORE SAVED CREDENTIALS
  // --------------------------------------------------

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('connectx_saved_email');
      const savedPassword = localStorage.getItem('connectx_saved_password');

      if (savedEmail) {
        setEmail(savedEmail);
      }

      if (savedPassword) {
        setPassword(savedPassword);
      }
    } catch {
      // Ignore local storage errors
    }
  }, []);

  // --------------------------------------------------
  // NORMALIZE PHONE NUMBER
  // --------------------------------------------------

  const normalizePhoneNumber = (
    code: string,
    phone: string
  ): string => {
    const cleanCode = code.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanCode || !cleanPhone) {
      return '';
    }

    return `+${cleanCode}${cleanPhone}`;
  };

  // --------------------------------------------------
  // SUBMIT
  // --------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSavedSuccessMsg(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    const cleanName = name.trim();

    try {
      if (isRegister) {
        // --------------------------------------------
        // NAME VALIDATION
        // --------------------------------------------

        if (cleanName.length < 2) {
          throw new Error('Please enter your full name.');
        }

        // --------------------------------------------
        // PHONE VALIDATION
        // --------------------------------------------

        const cleanPhone = phoneNumber.replace(/\D/g, '');

        if (!cleanPhone) {
          throw new Error('Please enter your phone number.');
        }

        if (cleanPhone.length < 7) {
          throw new Error('Please enter a valid phone number.');
        }

        // --------------------------------------------
        // CREATE INTERNATIONAL PHONE NUMBER
        // Example:
        // Country: +91
        // Number: 9876543210
        // Result: +919876543210
        // --------------------------------------------

        const fullPhoneNumber = normalizePhoneNumber(
          countryCode,
          phoneNumber
        );

        if (!fullPhoneNumber) {
          throw new Error('Please enter a valid phone number.');
        }

        // --------------------------------------------
        // REGISTER USER
        // --------------------------------------------

        await register(
          cleanName,
          cleanEmail,
          cleanPassword,
          fullPhoneNumber
        );

        setSavedSuccessMsg(
          'Account registered and saved in database successfully!'
        );
      } else {
        // --------------------------------------------
        // LOGIN
        // --------------------------------------------

        await login(cleanEmail, cleanPassword);
      }

      // --------------------------------------------
      // SAVE LOGIN CREDENTIALS
      // --------------------------------------------

      if (rememberCredentials) {
        localStorage.setItem(
          'connectx_saved_email',
          cleanEmail
        );

        localStorage.setItem(
          'connectx_saved_password',
          cleanPassword
        );
      } else {
        localStorage.removeItem('connectx_saved_password');
      }
    } catch (err: any) {
      setError(
        err.message ||
          'Authentication failed. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // SWITCH LOGIN / REGISTER
  // --------------------------------------------------

  const toggleAuthMode = () => {
    setIsRegister(!isRegister);
    setError(null);
    setSavedSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl relative my-4">

          {/* ------------------------------------------------ */}
          {/* BRAND */}
          {/* ------------------------------------------------ */}

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-cyan-900/30 mb-3">
              <Globe className="w-6 h-6 text-white" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">
              Connect<span className="text-cyan-400">X</span>
            </h2>

            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Enterprise Internet Communication Platform with
              WebRTC Calling & Workspaces
            </p>
          </div>

          {/* ------------------------------------------------ */}
          {/* DEMO ACCOUNTS */}
          {/* ------------------------------------------------ */}

          <div className="mb-5 p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 mb-2">
              <ShieldCheck className="w-4 h-4" />

              <span>
                Instant Test Accounts (1-Click Login)
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-2.5">
              Test multi-party calling and real-time messaging
              across two browser tabs instantly:
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => switchDemoUser(1)}
                className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer text-center"
              >
                Elena (UK)
              </button>

              <button
                type="button"
                onClick={() => switchDemoUser(2)}
                className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer text-center"
              >
                Kenji (JP)
              </button>

              <button
                type="button"
                onClick={() => switchDemoUser(3)}
                className="px-2 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer text-center"
              >
                Marcus (US)
              </button>
            </div>
          </div>

          {/* ------------------------------------------------ */}
          {/* DIVIDER */}
          {/* ------------------------------------------------ */}

          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-slate-800"></div>

            <span className="flex-shrink mx-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              {isRegister
                ? 'Register New Account'
                : 'Or use your credentials'}
            </span>

            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* ------------------------------------------------ */}
          {/* ERROR */}
          {/* ------------------------------------------------ */}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* SUCCESS */}
          {/* ------------------------------------------------ */}

          {savedSuccessMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />

              <span>{savedSuccessMsg}</span>
            </div>
          )}

          {/* ------------------------------------------------ */}
          {/* FORM */}
          {/* ------------------------------------------------ */}

          <form
            onSubmit={handleSubmit}
            className="space-y-3.5"
          >

            {/* ---------------------------------------------- */}
            {/* FULL NAME */}
            {/* ---------------------------------------------- */}

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>

                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />

                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="e.g. Dr. Jane Foster"
                    required
                    autoComplete="name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* ---------------------------------------------- */}
            {/* EMAIL */}
            {/* ---------------------------------------------- */}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>

              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="name@enterprise.corp"
                  required
                  autoComplete="email"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* ---------------------------------------------- */}
            {/* COUNTRY + PHONE */}
            {/* ---------------------------------------------- */}

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Phone Number
                </label>

                <div className="flex gap-2">

                  {/* COUNTRY */}
                  <div className="relative w-[115px] shrink-0">
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />

                    <select
                      value={countryCode}
                      onChange={(e) =>
                        setCountryCode(e.target.value)
                      }
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-2.5 py-2.5 text-xs text-white focus:border-cyan-500 outline-none cursor-pointer"
                    >
                      <option value="+91">
                        India +91
                      </option>

                      <option value="+44">
                        UK +44
                      </option>

                      <option value="+1">
                        USA +1
                      </option>

                      <option value="+81">
                        Japan +81
                      </option>

                      <option value="+49">
                        Germany +49
                      </option>

                      <option value="+33">
                        France +33
                      </option>

                      <option value="+61">
                        Australia +61
                      </option>

                      <option value="+971">
                        UAE +971
                      </option>

                      <option value="+65">
                        Singapore +65
                      </option>

                      <option value="+94">
                        Sri Lanka +94
                      </option>

                      <option value="+880">
                        Bangladesh +880
                      </option>

                      <option value="+92">
                        Pakistan +92
                      </option>

                      <option value="+86">
                        China +86
                      </option>

                      <option value="+7">
                        Russia +7
                      </option>

                      <option value="+39">
                        Italy +39
                      </option>

                      <option value="+34">
                        Spain +34
                      </option>

                      <option value="+55">
                        Brazil +55
                      </option>

                      <option value="+27">
                        South Africa +27
                      </option>

                      <option value="+52">
                        Mexico +52
                      </option>
                    </select>
                  </div>

                  {/* PHONE NUMBER */}
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />

                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value =
                          e.target.value.replace(
                            /[^\d\s()-]/g,
                            ''
                          );

                        setPhoneNumber(value);
                      }}
                      placeholder="98765 43210"
                      required
                      autoComplete="tel"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 mt-1">
                  Your international ConnectX number will be
                  used to identify your account for calls.
                </p>
              </div>
            )}

            {/* ---------------------------------------------- */}
            {/* PASSWORD */}
            {/* ---------------------------------------------- */}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Password
                </label>

                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}

                    <span>
                      {showPassword ? 'Hide' : 'Show'}
                    </span>
                  </button>
                )}
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="••••••••••••"
                  required
                  autoComplete={
                    isRegister
                      ? 'new-password'
                      : 'current-password'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* ---------------------------------------------- */}
            {/* REMEMBER LOGIN */}
            {/* ---------------------------------------------- */}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberCredentials}
                  onChange={(e) =>
                    setRememberCredentials(
                      e.target.checked
                    )
                  }
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5"
                />

                <span>
                  Remember login on this browser
                </span>
              </label>

              <div
                className="flex items-center gap-1 text-[11px] text-slate-500"
                title="All users and passwords persist in the server database file"
              >
                <Database className="w-3 h-3 text-cyan-500" />

                <span>Saved in DB</span>
              </div>
            </div>

            {/* ---------------------------------------------- */}
            {/* SUBMIT */}
            {/* ---------------------------------------------- */}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-900/30 cursor-pointer mt-2"
            >
              <span>
                {loading
                  ? 'Processing...'
                  : isRegister
                    ? 'Register & Save Account'
                    : 'Sign In'}
              </span>

              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* ------------------------------------------------ */}
          {/* SWITCH LOGIN / REGISTER */}
          {/* ------------------------------------------------ */}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleAuthMode}
              className="text-xs text-slate-400 hover:text-cyan-400 transition cursor-pointer"
            >
              {isRegister
                ? 'Already registered? Click to Sign In'
                : 'Register a new account (Saves email & password)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
