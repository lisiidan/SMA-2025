/**
 * Imgur Image Upload Service
 *
 * This service uploads images to Imgur and returns the URL.
 * No authentication required for anonymous uploads.
 */

const IMGUR_CLIENT_ID = "546c25a59c58ad7"; // Anonymous Imgur Client ID (public, safe to use)
const IMGUR_UPLOAD_URL = "https://api.imgur.com/3/image";

/**
 * Uploads an image to Imgur and returns the URL
 * @param uri - Local file URI from image picker
 * @returns Imgur image URL
 */
export async function uploadImageToImgur(uri: string): Promise<string> {
  try {
    console.log("Starting Imgur upload...", { uri });

    // Read the image file as base64
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to base64
    const base64 = await blobToBase64(blob);

    // Remove the data:image/...;base64, prefix if present
    const base64Image = base64.split(",")[1] || base64;

    console.log("Image converted to base64, size:", base64Image.length);

    // Upload to Imgur
    const uploadResponse = await fetch(IMGUR_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        type: "base64",
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Imgur upload failed:", errorText);
      throw new Error(`Imgur upload failed: ${uploadResponse.status}`);
    }

    const result = await uploadResponse.json();
    console.log("Imgur upload successful!");

    if (result.success && result.data && result.data.link) {
      const imageUrl = result.data.link;
      console.log("Image URL:", imageUrl);
      return imageUrl;
    } else {
      throw new Error("Invalid response from Imgur");
    }
  } catch (error: any) {
    console.error("Error uploading to Imgur:", error);
    throw new Error(`Failed to upload image to Imgur: ${error.message}`);
  }
}

/**
 * Convert blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
