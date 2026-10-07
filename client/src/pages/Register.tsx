import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Input from "../components/Input";
import Button from "../components/Button";

import { registerUser } from "../services/authService";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      await registerUser(name.trim(), email.trim(), password);

      alert("Registration successful! Please sign in.");

      navigate("/login");
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          "Registration Failed"
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-2xl">

        <h1 className="mb-2 text-center text-4xl font-bold text-cyan-400">
          ConnectX
        </h1>

        <p className="mb-8 text-center text-slate-400">
          Create your account
        </p>

        <div className="space-y-5">

          <Input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button
            title="Create Account"
            onClick={handleRegister}
          />

        </div>

        <p className="mt-6 text-center text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-cyan-400"
          >
            Sign In
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Register;