import { Timestamp } from "firebase/firestore";

export interface QuestLocation {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  imageUrl: string;
  questRadius: number; // Radius in meters for auto-opening the card
  createdAt: Timestamp;
  createdBy: string; // Admin email or ID
  isActive: boolean; // Allow admins to disable quests
}

export interface QuestLocationInput {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  imageUri: string; // Local URI before upload
}
