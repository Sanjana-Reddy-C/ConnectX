import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const API = axios.create({
  baseURL: `${API_URL}/api/workspaces`,
});

export const getWorkspaces = async () => {
  const token = localStorage.getItem("token");

  const response = await API.get("/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

export const createWorkspace = async (
  name: string,
  description: string
) => {
  const token = localStorage.getItem("token");

  const response = await API.post(
    "/",
    {
      name,
      description,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};