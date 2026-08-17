import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Input from "../components/Input";
import Button from "../components/Button";

import { loginUser } from "../services/authService";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      const response = await loginUser(email, password);

      localStorage.setItem(
        "token",
        response.data.token
      );

      alert("Login Successful!");

      navigate("/dashboard");
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          "Login Failed"
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
          Enterprise Communication Platform
        </p>

        <div className="space-y-5">

          <Input
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <Button
            title="Sign In"
            onClick={handleLogin}
          />

        </div>

        <p className="mt-6 text-center text-slate-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-cyan-400"
          >
            Register
          </Link>
        </p>

      </div>
    </div>
  );
}

export default Login;