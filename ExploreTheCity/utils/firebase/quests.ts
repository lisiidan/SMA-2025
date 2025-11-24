import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./config";
import { QuestLocation } from "../../models/QuestLocation";
import { uploadImageToImgur } from "../imgur/upload";

const QUESTS_COLLECTION = "questLocations";

/**
 * Creates a new quest location in Firestore
 * @param questData - Quest data including local image URI
 * @param adminEmail - Email of the admin creating the quest
 * @returns Created quest ID
 */
export async function createQuestLocation(
  questData: {
    latitude: number;
    longitude: number;
    title: string;
    description: string;
    imageUri: string;
  },
  adminEmail: string
): Promise<string> {
  try {
    console.log("=== Creating Quest Location ===");
    console.log("Quest data:", {
      latitude: questData.latitude,
      longitude: questData.longitude,
      title: questData.title,
      hasImage: !!questData.imageUri
    });

    // Upload image to Imgur
    console.log("Step 1: Uploading image to Imgur...");
    const imageUrl = await uploadImageToImgur(questData.imageUri);
    console.log("Image uploaded successfully to Imgur! URL:", imageUrl);

    // Create quest document
    console.log("Step 2: Creating Firestore document...");
    const questDoc = {
      latitude: questData.latitude,
      longitude: questData.longitude,
      title: questData.title,
      description: questData.description,
      imageUrl: imageUrl,
      questRadius: 50, // Default radius of 50 meters
      createdAt: Timestamp.now(),
      createdBy: adminEmail,
      isActive: true,
    };

    const docRef = await addDoc(collection(db, QUESTS_COLLECTION), questDoc);
    console.log("Quest created successfully! ID:", docRef.id);
    console.log("=== Quest Creation Complete ===");

    return docRef.id;
  } catch (error: any) {
    console.error("=== Error Creating Quest Location ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error stack:", error.stack);

    // Re-throw with clearer error message
    throw new Error(`Failed to create quest: ${error.message}`);
  }
}

/**
 * Fetches all active quest locations
 * @returns Array of active quest locations
 */
export async function getActiveQuestLocations(): Promise<QuestLocation[]> {
  try {
    const q = query(
      collection(db, QUESTS_COLLECTION),
      where("isActive", "==", true)
    );

    const querySnapshot = await getDocs(q);
    const quests: QuestLocation[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Loading quest from Firestore:", { id: doc.id, data });

      quests.push({
        id: doc.id,
        ...data,
      } as QuestLocation);
    });

    console.log(`Loaded ${quests.length} active quest locations`);
    return quests;
  } catch (error) {
    console.error("Error fetching quest locations:", error);
    return [];
  }
}

/**
 * Updates an existing quest location
 * @param questId - ID of the quest to update
 * @param questData - Updated quest data
 * @returns void
 */
export async function updateQuestLocation(
  questId: string,
  questData: {
    title?: string;
    description?: string;
    imageUri?: string;
  }
): Promise<void> {
  try {
    console.log("=== Updating Quest Location ===");
    console.log("Quest ID:", questId);
    console.log("Update data:", questData);

    const questRef = doc(db, QUESTS_COLLECTION, questId);
    const updateData: any = {};

    if (questData.title !== undefined) {
      updateData.title = questData.title;
    }

    if (questData.description !== undefined) {
      updateData.description = questData.description;
    }

    // If new image provided, upload to Imgur
    if (questData.imageUri) {
      console.log("Uploading new image to Imgur...");
      const imageUrl = await uploadImageToImgur(questData.imageUri);
      updateData.imageUrl = imageUrl;
      console.log("New image uploaded:", imageUrl);
    }

    await updateDoc(questRef, updateData);
    console.log("Quest updated successfully!");
    console.log("=== Quest Update Complete ===");
  } catch (error) {
    console.error("Error updating quest location:", error);
    throw error;
  }
}

/**
 * Deactivates a quest location (soft delete)
 * @param questId - ID of the quest to deactivate
 */
export async function deactivateQuestLocation(questId: string): Promise<void> {
  try {
    console.log("Deactivating quest:", questId);
    const questRef = doc(db, QUESTS_COLLECTION, questId);
    await updateDoc(questRef, {
      isActive: false,
    });
    console.log("Quest deactivated successfully!");
  } catch (error) {
    console.error("Error deactivating quest location:", error);
    throw error;
  }
}
