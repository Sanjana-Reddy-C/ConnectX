import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const API = axios.create({
  baseURL: `${API_URL}/api/auth`,
});

export const loginUser = async (
  email: string,
  password: string
) => {
  const response = await API.post("/login", {
    email,
    password,
  });

  return response.data;
};

export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  const response = await API.post("/register", {
    name,
    email,
    password,
  });

  return response.data;
};