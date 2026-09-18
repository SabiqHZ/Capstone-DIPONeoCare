import axios from 'axios';
import { api } from "./api";
import { AuthUser } from "../types";

interface NurseLoginResponse {
  role: 'nurse';
  id: string;
  name: string;
  unitId: string;
  token: string;
}

function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  if (!error.response) {
    return 'Tidak dapat menghubungi server. Pastikan backend aktif dan ponsel berada di Wi-Fi yang sama.';
  }

  return error.response.data?.error || fallback;
}

export const authService = {
  loginWithCode: async (code: string): Promise<AuthUser> => {
    try {
      const res = await api.post("/auth/parent", { uniqueCode: code });
      return res.data.data as AuthUser;
    } catch (error: unknown) {
      throw new Error(getAuthErrorMessage(error, 'Kode tidak valid'));
    }
  },

  loginCaregiver: async (
    username: string,
    password: string,
  ): Promise<AuthUser> => {
    try {
      const res = await api.post("/auth/nurse", { username, password });
      const nurse = res.data.data as NurseLoginResponse;

      // API/database tetap memakai "nurse"; UI menyebut peran ini "caregiver".
      return {
        id: nurse.id,
        name: nurse.name,
        unitId: nurse.unitId,
        token: nurse.token,
        role: 'caregiver',
      };
    } catch (error: unknown) {
      throw new Error(getAuthErrorMessage(error, 'Username atau password salah'));
    }
  },
};
