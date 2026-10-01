import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3000/api/auth",
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