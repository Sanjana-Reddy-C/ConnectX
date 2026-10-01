import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:3000/api/workspaces",
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