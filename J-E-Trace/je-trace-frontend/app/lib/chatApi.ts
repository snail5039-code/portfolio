import api from "./axios";

export const sendMessage = async (message: string) => {
  const res = await api.post("/api/chat", {
    message,
  });
  return res.data;
};