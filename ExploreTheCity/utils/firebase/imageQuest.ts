/**
 * ImageQuest Firebase Service
 *
 * Serviciu pentru gestionarea quest-urilor și integrarea cu Firebase și Gemini AI
 */

import { haversineDistance } from '@/domain/geo/distance';
import type { LatLng } from '@/domain/geo/grid';
import type { ImageComparisonResult, ImageQuest } from '@/models/ImageQuest';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { compareImages } from '../gemini';
import { uploadImageToImgur } from '../imgur/upload';
import { db } from './config';

const IMAGE_QUESTS_COLLECTION = 'imageQuests';
const CLIENTS_COLLECTION = 'clients';
const CONFIDENCE_THRESHOLD = 90; // Nivel minim de încredere pentru a marca quest-ul ca rezolvat (90%)

/**
 * Creates a new image quest in Firestore
 * @param questData - Quest data including local image URI
 * @param orgId - ID of the organizer creating the quest
 * @returns Created quest ID
 */
export async function createImageQuest(
  questData: {
    latitude: number;
    longitude: number;
    description: string;
    imageUri: string;
    score?: number;
    questRadius?: number;
  },
  orgId: string
): Promise<string> {
  try {
    console.log("=== Creating Image Quest ===");
    console.log("Quest data:", {
      latitude: questData.latitude,
      longitude: questData.longitude,
      description: questData.description,
      hasImage: !!questData.imageUri,
      score: questData.score,
      questRadius: questData.questRadius
    });

    // Upload image to Imgur
    console.log("Step 1: Uploading image to Imgur...");
    const imageUrl = await uploadImageToImgur(questData.imageUri);
    console.log("Image uploaded successfully to Imgur! URL:", imageUrl);

    // Create quest document
    console.log("Step 2: Creating Firestore document...");
    const questDoc = {
      orgId: orgId,
      description: questData.description,
      latitude: questData.latitude,
      longitude: questData.longitude,
      imageUrl: imageUrl,
      referenceImageUrl: imageUrl, // Also store as referenceImageUrl for compatibility
      score: questData.score || 100, // Default score of 100 points
      questRadius: questData.questRadius || 100, // Default radius of 100 meters
      createdAt: Timestamp.now(),
      isActive: true, // Add isActive flag for soft delete
    };

    const docRef = await addDoc(collection(db, IMAGE_QUESTS_COLLECTION), questDoc);
    console.log("Image Quest created successfully! ID:", docRef.id);
    console.log("=== Image Quest Creation Complete ===");

    return docRef.id;
  } catch (error: any) {
    console.error("=== Error Creating Image Quest ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error stack:", error.stack);

    // Re-throw with clearer error message
    throw new Error(`Failed to create image quest: ${error.message}`);
  }
}

/**
 * Updates an existing image quest
 * @param questId - ID of the quest to update
 * @param questData - Updated quest data
 * @returns void
 */
export async function updateImageQuest(
  questId: string,
  questData: {
    description?: string;
    imageUri?: string;
    score?: number;
    questRadius?: number;
  }
): Promise<void> {
  try {
    console.log("=== Updating Image Quest ===");
    console.log("Quest ID:", questId);
    console.log("Update data:", questData);

    const questRef = doc(db, IMAGE_QUESTS_COLLECTION, questId);
    const updateData: any = {};

    if (questData.description !== undefined) {
      updateData.description = questData.description;
    }

    if (questData.score !== undefined) {
      updateData.score = questData.score;
    }

    if (questData.questRadius !== undefined) {
      updateData.questRadius = questData.questRadius;
    }

    // If new image provided, upload to Imgur
    if (questData.imageUri) {
      console.log("Uploading new image to Imgur...");
      const imageUrl = await uploadImageToImgur(questData.imageUri);
      updateData.imageUrl = imageUrl;
      updateData.referenceImageUrl = imageUrl; // Update both for compatibility
      console.log("New image uploaded:", imageUrl);
    }

    await updateDoc(questRef, updateData);
    console.log("Image Quest updated successfully!");
    console.log("=== Image Quest Update Complete ===");
  } catch (error) {
    console.error("Error updating image quest:", error);
    throw error;
  }
}

/**
 * Deactivates an image quest (soft delete)
 * @param questId - ID of the quest to deactivate
 */
export async function deactivateImageQuest(questId: string): Promise<void> {
  try {
    console.log("Deactivating image quest:", questId);
    const questRef = doc(db, IMAGE_QUESTS_COLLECTION, questId);
    await updateDoc(questRef, {
      isActive: false,
    });
    console.log("Image Quest deactivated successfully!");
  } catch (error) {
    console.error("Error deactivating image quest:", error);
    throw error;
  }
}

/**
 * Obține toate ImageQuests active din Firebase
 */
export const getAllImageQuests = async (): Promise<ImageQuest[]> => {
  try {
    console.log('📥 [getAllImageQuests] Fetching quests from Firebase collection:', IMAGE_QUESTS_COLLECTION);
    const questsRef = collection(db, IMAGE_QUESTS_COLLECTION);
    const snapshot = await getDocs(questsRef);
    console.log('✅ [getAllImageQuests] Snapshot received, documents count:', snapshot.size);

    const quests: ImageQuest[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log(`📄 [getAllImageQuests] Processing document ID: ${docSnap.id}`, data);

      // Skip inactive quests
      if (data.isActive === false) {
        console.log(`⏭️ [getAllImageQuests] Skipping inactive quest ${docSnap.id}`);
        return;
      }

      const quest = {
        questId: docSnap.id,
        orgId: data.orgId,
        description: data.description,
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: data.referenceImageUrl || data.imageUrl || '', // Încearcă referenceImageUrl, apoi imageUrl
        score: data.score || 100,
        questRadius: data.questRadius || 100,
        createdAt: data.createdAt,
      };

      console.log(`✅ [getAllImageQuests] Quest processed:`, quest);
      console.log(`🖼️ [getAllImageQuests] Image URL for quest ${docSnap.id}:`, quest.imageUrl);
      quests.push(quest);
    });

    console.log(`🎯 [getAllImageQuests] Total quests loaded: ${quests.length}`);
    return quests;
  } catch (error) {
    console.error('❌ [getAllImageQuests] Error loading quests:', error);
    console.error('❌ [getAllImageQuests] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error('Nu s-au putut încărca quest-urile de imagini');
  }
};

/**
 * Obține un ImageQuest specific după ID
 */
export const getImageQuestById = async (questId: string): Promise<ImageQuest | null> => {
  try {
    const questRef = doc(db, IMAGE_QUESTS_COLLECTION, questId);
    const questDoc = await getDoc(questRef);
    
    if (!questDoc.exists()) {
      return null;
    }
    
    const data = questDoc.data();
    return {
      questId: questDoc.id,
      orgId: data.orgId,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      imageUrl: data.imageUrl,
      score: data.score || 100,
      questRadius: data.questRadius || 100,
      createdAt: data.createdAt,
    };
  } catch (error) {
    console.error('Eroare la încărcarea quest-ului:', error);
    throw new Error('Nu s-a putut încărca quest-ul de imagini');
  }
};

/**
 * Obține ImageQuests apropiate bazat pe locația utilizatorului
 */
export const getNearbyImageQuests = async (
  userLocation: LatLng,
  radiusMeters: number = 1000
): Promise<ImageQuest[]> => {
  try {
    const allQuests = await getAllImageQuests();
    
    // Filtrează quest-urile după distanță
    const nearbyQuests = allQuests.filter((quest) => {
      const questLocation: LatLng = {
        lat: quest.latitude,
        lng: quest.longitude,
      };
      
      const distance = haversineDistance(userLocation, questLocation);
      return distance <= radiusMeters;
    });
    
    return nearbyQuests;
  } catch (error) {
    console.error('Eroare la încărcarea quest-urilor apropiate:', error);
    throw new Error('Nu s-au putut încărca quest-urile apropiate');
  }
};

/**
 * Găsește cel mai bun ImageQuest pentru imaginea capturată de utilizator
 * Compară imaginea cu quest-urile apropiate și returnează cea mai bună potrivire
 */
export const findMatchingQuest = async (
  userImageUri: string,
  userLocation: LatLng,
  clientId: string
): Promise<{
  quest: ImageQuest | null;
  comparisonResult: ImageComparisonResult;
}> => {
  try {
    console.log('🔎 [findMatchingQuest] Starting to find matching quest...');

    // Obține toate quest-urile și filtrează-le după raza lor individuală
    console.log('📥 [findMatchingQuest] Getting all quests...');
    const allQuests = await getAllImageQuests();
    console.log(`📋 [findMatchingQuest] Total quests loaded: ${allQuests.length}`);

    // Filtrează quest-urile care sunt în raza lor specificată
    const nearbyQuests = allQuests.filter((quest) => {
      const questLocation: LatLng = {
        lat: quest.latitude,
        lng: quest.longitude,
      };

      const distance = haversineDistance(userLocation, questLocation);
      console.log(`📏 [findMatchingQuest] Quest ${quest.questId} (${quest.description}): distance=${distance.toFixed(2)}m, radius=${quest.questRadius}m`);
      return distance <= quest.questRadius; // Folosește raza specifică quest-ului
    });

    console.log(`🎯 [findMatchingQuest] Nearby quests (within radius): ${nearbyQuests.length}`);

    if (nearbyQuests.length === 0) {
      console.log('❌ [findMatchingQuest] No quests in range');
      return {
        quest: null,
        comparisonResult: {
          isMatch: false,
          confidence: 0,
          reasoning: 'Nu există quest-uri disponibile în locația ta curentă',
        },
      };
    }

    // Obține datele clientului pentru a verifica quest-urile rezolvate
    console.log('👤 [findMatchingQuest] Checking solved quests for client...');
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientDoc = await getDoc(clientRef);
    const solvedQuestIds = clientDoc.exists()
      ? (clientDoc.data().imageQuestSolvedIds || [])
      : [];
    console.log('✅ [findMatchingQuest] Solved quest IDs:', solvedQuestIds);

    // Filtrează quest-urile deja rezolvate
    const unsolvedQuests = nearbyQuests.filter((q) => {
      const isSolved = solvedQuestIds.includes(q.questId); // Compară ca string
      console.log(`  Quest ${q.questId}: isSolved=${isSolved}`);
      return !isSolved;
    });
    console.log(`🆕 [findMatchingQuest] Unsolved quests: ${unsolvedQuests.length}`);

    if (unsolvedQuests.length === 0) {
      console.log('❌ [findMatchingQuest] All nearby quests are already solved');
      return {
        quest: null,
        comparisonResult: {
          isMatch: false,
          confidence: 0,
          reasoning: 'Toate quest-urile din apropiere au fost completate',
        },
      };
    }

    // Compară cu fiecare quest din apropiere și găsește cea mai bună potrivire
    let bestMatch: { quest: ImageQuest; result: ImageComparisonResult } | null = null;

    console.log(`🔄 [findMatchingQuest] Comparing with ${unsolvedQuests.length} unsolved quests...`);
    for (const quest of unsolvedQuests) {
      if (!quest.imageUrl) {
        console.log(`⚠️ [findMatchingQuest] Quest ${quest.questId} has no image URL, skipping`);
        continue;
      }

      try {
        console.log(`🖼️ [findMatchingQuest] Comparing with quest ${quest.questId}: "${quest.description}"`);

        // Obține URL-ul imaginii de referință din Firebase Storage dacă este necesar
        let referenceImageUrl = quest.imageUrl;
        if (!referenceImageUrl.startsWith('http')) {
          // Dacă este un path Firebase Storage, obține URL-ul de download
          // const imageRef = ref(storage, quest.imageUrl);
          // referenceImageUrl = await getDownloadURL(imageRef);
          // Pentru moment presupunem că imageUrl este deja un URL complet
          console.log(`⚠️ [findMatchingQuest] Quest ${quest.questId} imageUrl doesn't start with http:`, referenceImageUrl);
        }

        // Compară imaginile folosind Gemini AI
        console.log(`🤖 [findMatchingQuest] Calling Gemini AI to compare images for quest ${quest.questId}...`);
        const comparisonResult = await compareImages(
          userImageUri,
          referenceImageUrl,
          quest.description
        );
        console.log(`📊 [findMatchingQuest] Quest ${quest.questId} comparison result:`, comparisonResult);

        // Actualizează cea mai bună potrivire dacă aceasta este mai bună
        // Și verifică că confidence este peste threshold-ul de 90%
        if (
          comparisonResult.isMatch &&
          comparisonResult.confidence >= CONFIDENCE_THRESHOLD &&
          (!bestMatch || comparisonResult.confidence > bestMatch.result.confidence)
        ) {
          console.log(`🌟 [findMatchingQuest] New best match found! Quest ${quest.questId} with confidence ${comparisonResult.confidence}%`);
          bestMatch = {
            quest,
            result: comparisonResult,
          };
        } else {
          console.log(`⚪ [findMatchingQuest] Quest ${quest.questId} not a match (isMatch: ${comparisonResult.isMatch}, confidence: ${comparisonResult.confidence}%, threshold: ${CONFIDENCE_THRESHOLD}%)`);
        }
      } catch (error) {
        console.error(`❌ [findMatchingQuest] Error comparing with quest ${quest.questId}:`, error);
        // Continuă cu următorul quest
      }
    }

    if (!bestMatch) {
      console.log('❌ [findMatchingQuest] No matching quest found after comparing all unsolved quests');
      return {
        quest: null,
        comparisonResult: {
          isMatch: false,
          confidence: 0,
          reasoning: 'Nu s-a găsit niciun quest potrivit în această zonă',
        },
      };
    }

    console.log(`🎉 [findMatchingQuest] Best match found: Quest ${bestMatch.quest.questId} with confidence ${bestMatch.result.confidence}%`);
    return {
      quest: bestMatch.quest,
      comparisonResult: {
        ...bestMatch.result,
        matchedQuestId: bestMatch.quest.questId,
      },
    };
  } catch (error) {
    console.error('❌ [findMatchingQuest] Error:', error);
    console.error('❌ [findMatchingQuest] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error('Nu s-a putut procesa imaginea');
  }
};

/**
 * Marchează un ImageQuest ca rezolvat pentru un client
 * Actualizează lista de quest-uri rezolvate și scorul acumulat al clientului
 */
export const markQuestAsSolved = async (
  clientId: string,
  questId: string,
  pointsEarned: number = 100
): Promise<void> => {
  try {
    console.log('💾 [markQuestAsSolved] Marking quest as solved...');
    console.log('👤 [markQuestAsSolved] Client ID:', clientId);
    console.log('🎯 [markQuestAsSolved] Quest ID:', questId, 'Type:', typeof questId);
    console.log('💰 [markQuestAsSolved] Points earned:', pointsEarned);

    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    
    // Nu mai convertim la parseInt - păstrăm questId ca string
    await updateDoc(clientRef, {
      imageQuestSolvedIds: arrayUnion(questId), // Folosește questId direct ca string
      accumulatedScore: increment(pointsEarned),
    });

    console.log('✅ [markQuestAsSolved] Quest successfully marked as solved');
  } catch (error) {
    console.error('❌ [markQuestAsSolved] Eroare la marcarea quest-ului ca rezolvat:', error);
    console.error('❌ [markQuestAsSolved] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error('Nu s-a putut actualiza statusul quest-ului');
  }
};

/**
 * Obține toate ImageQuests cu statusul lor (rezolvat/nerezolvat) pentru un client
 */
export const getQuestsWithStatus = async (
  clientId: string
): Promise<Array<ImageQuest & { isSolved: boolean }>> => {
  try {
    console.log('🔍 [getQuestsWithStatus] Getting quests with status for client:', clientId);

    console.log('📥 [getQuestsWithStatus] Fetching all quests...');
    const allQuests = await getAllImageQuests();
    console.log('✅ [getQuestsWithStatus] All quests fetched:', allQuests.length);

    console.log('👤 [getQuestsWithStatus] Fetching client document...');
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientDoc = await getDoc(clientRef);
    console.log('✅ [getQuestsWithStatus] Client document exists:', clientDoc.exists());

    const solvedQuestIds = clientDoc.exists()
      ? (clientDoc.data().imageQuestSolvedIds || [])
      : [];
    console.log('✅ [getQuestsWithStatus] Solved quest IDs:', solvedQuestIds);
    console.log('🔍 [getQuestsWithStatus] Solved quest IDs types:', solvedQuestIds.map((id: any) => typeof id));

    const questsWithStatus = allQuests.map((quest) => {
      // Compară questId ca string (nu mai folosim parseInt)
      const isSolved = solvedQuestIds.includes(quest.questId);
      console.log(`  Checking quest ${quest.questId}: isSolved=${isSolved}`);
      return {
        ...quest,
        isSolved,
      };
    });

    console.log('🎯 [getQuestsWithStatus] Quests with status prepared:', questsWithStatus.length);
    questsWithStatus.forEach((q, index) => {
      console.log(`  Quest ${index + 1}: ID=${q.questId}, isSolved=${q.isSolved}, description="${q.description}"`);
    });

    return questsWithStatus;
  } catch (error) {
    console.error('❌ [getQuestsWithStatus] Error loading quests with status:', error);
    console.error('❌ [getQuestsWithStatus] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error('Nu s-au putut încărca quest-urile');
  }
};

/**
 * Trimite imaginea capturată de utilizator pentru verificarea quest-ului
 * Workflow complet: găsește quest-ul potrivit, verifică și actualizează progresul utilizatorului
 */
export const submitQuestImage = async (
  userImageUri: string,
  userLocation: LatLng,
  clientId: string
): Promise<{
  success: boolean;
  quest?: ImageQuest;
  result: ImageComparisonResult;
  pointsEarned?: number;
}> => {
  try {
    console.log('🔍 [submitQuestImage] Starting quest image submission...');
    console.log('📸 [submitQuestImage] Image URI:', userImageUri);
    console.log('📍 [submitQuestImage] User location:', userLocation);
    console.log('👤 [submitQuestImage] Client ID:', clientId);

    // Găsește quest-ul potrivit
    console.log('🔎 [submitQuestImage] Finding matching quest...');
    const { quest, comparisonResult } = await findMatchingQuest(
      userImageUri,
      userLocation,
      clientId
    );
    console.log('✅ [submitQuestImage] findMatchingQuest completed');
    console.log('🎯 [submitQuestImage] Quest found:', quest ? quest.questId : 'null');
    console.log('📊 [submitQuestImage] Comparison result:', comparisonResult);

    if (!quest || !comparisonResult.isMatch) {
      console.log('❌ [submitQuestImage] No matching quest found or not a match');
      return {
        success: false,
        result: comparisonResult,
      };
    }

    // Calculează punctele bazate pe scorul quest-ului, nu pe confidence
    const pointsEarned = quest.score;
    console.log('💰 [submitQuestImage] Points to be earned:', pointsEarned);

    // Marchează quest-ul ca rezolvat
    console.log('💾 [submitQuestImage] Marking quest as solved...');
    await markQuestAsSolved(clientId, quest.questId, pointsEarned);
    console.log('✅ [submitQuestImage] Quest marked as solved');

    const result = {
      success: true,
      quest,
      result: comparisonResult,
      pointsEarned,
    };
    console.log('🎉 [submitQuestImage] Success! Returning result:', result);

    return result;
  } catch (error) {
    console.error('❌ [submitQuestImage] Error:', error);
    console.error('❌ [submitQuestImage] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error('Nu s-a putut trimite imaginea pentru quest');
  }
};
