import api from "./axios";

export const getTestMessage = async () => {
  const response = await api.get("/api/test");
  return response.data;
};