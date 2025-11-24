/**
 * ImageQuest Model
 *
 * Modelul pentru quest-uri bazate pe imagini conform schemei din backend
 * Descris în Docs/WalkWithMeClass.drawio.svg
 */

import { Timestamp } from 'firebase/firestore';

export interface ImageQuest {
  questId: string;           // Primary Key
  orgId: string;             // Foreign Key - ID organizator
  description: string;       // Descrierea quest-ului
  latitude: number;          // Latitudine locație
  longitude: number;         // Longitudine locație
  imageUrl?: string;         // URL imagine de referință (Firebase Storage)
  score: number;             // Puncte acordate pentru completarea quest-ului
  questRadius: number;       // Raza în metri în care utilizatorul trebuie să fie pentru a face poză
  createdAt: Timestamp;      // Timestamp creare quest
}

/**
 * Date pentru crearea unui ImageQuest nou
 */
export interface CreateImageQuestData {
  orgId: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  score: number;
  questRadius: number;
}

/**
 * Rezultatul comparării de imagini cu Gemini AI
 */
export interface ImageComparisonResult {
  isMatch: boolean;          // Dacă imaginile au același obiect
  confidence: number;        // Nivel de încredere (0-100)
  reasoning: string;         // Explicația AI
  matchedQuestId?: string;   // ID-ul quest-ului găsit (dacă există)
}

/**
 * Creează un obiect ImageQuest cu valori inițiale
 */
export const createImageQuest = (data: CreateImageQuestData): Omit<ImageQuest, 'questId' | 'createdAt'> => {
  return {
    orgId: data.orgId,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    imageUrl: data.imageUrl,
    score: data.score,
    questRadius: data.questRadius,
  };
};

/**
 * Validează datele unui ImageQuest
 */
export const validateImageQuest = (quest: Partial<ImageQuest>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!quest.orgId || quest.orgId.trim() === '') {
    errors.push('Organization ID is required');
  }

  if (!quest.description || quest.description.trim() === '') {
    errors.push('Description is required');
  }

  if (quest.latitude === undefined || quest.latitude < -90 || quest.latitude > 90) {
    errors.push('Valid latitude is required (-90 to 90)');
  }

  if (quest.longitude === undefined || quest.longitude < -180 || quest.longitude > 180) {
    errors.push('Valid longitude is required (-180 to 180)');
  }

  if (quest.score === undefined || quest.score < 0) {
    errors.push('Score must be a positive number');
  }

  if (quest.questRadius === undefined || quest.questRadius <= 0) {
    errors.push('Quest radius must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
