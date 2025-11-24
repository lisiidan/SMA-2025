/**
 * Client Model
 *
 * Modelul pentru utilizatorii aplicației
 */

import { Timestamp } from 'firebase/firestore';

export interface Client {
  clientId: string;              // UID Firebase Auth
  name: string;                  // Numele utilizatorului
  accumulatedScore: number;      // Scorul acumulat
  mapGridIds: string[];          // Listă de ID-uri pentru grid-ul hartă
  imageQuestSolvedIds: number[]; // Listă de ID-uri pentru quest-uri rezolvate
  createdAt: Timestamp;          // Timestamp creare cont
  lastLoginAt?: Timestamp;       // Timestamp ultima autentificare (opțional)
  email: string;                 // Email utilizator
}

/**
 * Date pentru crearea unui client nou
 */
export interface CreateClientData {
  clientId: string;
  name: string;
  email: string;
}

/**
 * Creează un obiect Client cu valori inițiale
 */
export const createClient = (data: CreateClientData): Omit<Client, 'createdAt'> => {
  return {
    clientId: data.clientId,
    name: data.name,
    email: data.email,
    accumulatedScore: 0,
    mapGridIds: [],
    imageQuestSolvedIds: [],
  };
};

/**
 * Validează datele unui client
 */
export const validateClient = (client: Partial<Client>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!client.clientId || client.clientId.trim() === '') {
    errors.push('Client ID is required');
  }

  if (!client.name || client.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!client.email || client.email.trim() === '') {
    errors.push('Email is required');
  }

  if (client.accumulatedScore !== undefined && client.accumulatedScore < 0) {
    errors.push('Accumulated score cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
