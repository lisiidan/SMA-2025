import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { app } from "./config";

const storage = getStorage(app);

/**
 * Uploads an image to Firebase Storage and returns the download URL
 * @param uri - Local file URI from image picker
 * @param path - Storage path (e.g., 'quests/quest-123.jpg')
 * @returns Download URL of the uploaded image
 */
export async function uploadImage(uri: string, path: string): Promise<string> {
  try {
    console.log("Starting image upload...", { uri, path });

    // Fetch the image as a blob
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    console.log("Blob created:", { type: blob.type, size: blob.size });

    // Create a storage reference
    const storageRef = ref(storage, path);
    console.log("Storage reference created:", storageRef.fullPath);

    // Upload the blob with resumable upload
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: blob.type || 'image/jpeg',
    });

    // Wait for upload to complete
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload is ${progress.toFixed(0)}% done`);
        },
        (error) => {
          console.error("Upload error:", error);
          console.error("Error code:", error.code);
          console.error("Error message:", error.message);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log("Upload successful! Download URL:", downloadURL);
            resolve(downloadURL);
          } catch (error) {
            console.error("Error getting download URL:", error);
            reject(new Error("Failed to get download URL"));
          }
        }
      );
    });
  } catch (error: any) {
    console.error("Error in uploadImage:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Generates a unique filename for quest images
 * @returns Unique filename with timestamp
 */
export function generateQuestImageFilename(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `quests/quest-${timestamp}-${random}.jpg`;
}
