/**
 * Gemini AI Service
 *
 * Serviciu pentru compararea imaginilor folosind Google Gemini Vision API
 *
 * OPTIMIZAT PENTRU GEMINI-2.5-FLASH FREE TIER:
 * - Folosește gemini-2.5-flash (versiunea cea mai nouă și mai bună)
 * - Elimina validări suplimentare care consumă API requests (analyzeImage, validateImageContent)
 * - Folosește doar funcția compareImages pentru comparații eficiente
 * - Rate limiting: 4s între requests pentru a respecta limitele free tier (15 RPM)
 * - Compresie agresivă a imaginilor (512x512, 60% quality) pentru a reduce tokenii
 * - Prompt concis pentru a reduce consumul de tokeni
 *
 * FREE TIER LIMITS (gemini-2.5-flash):
 * - 15 RPM (requests per minute)
 * - 4 million TPM (tokens per minute)
 * - 1,500 RPD (requests per day)
 *
 * Standarde Gemini Vision API:
 * - Formate suportate: JPEG, PNG, WEBP, HEIC, HEIF
 * - Dimensiune maximă request inline: 20MB (text + imagini combinate)
 * - Dimensiune recomandată per imagine: 4-5MB pentru performanță optimă
 * - Număr maxim imagini per request: 3600 (pentru Gemini 2.0 Flash)
 */

import type { ImageComparisonResult } from '@/models/ImageQuest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Inițializare Gemini AI cu API key din configurare
const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey || '';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ Gemini API Key nu este configurat! Verifică fișierul .env');
  console.warn('⚠️ Adaugă GEMINI_API_KEY în .env file');
} else {
  console.log('✅ Gemini API Key loaded successfully (length:', GEMINI_API_KEY.length, ')');
  // Verifică dacă API key-ul arată valid (ar trebui să înceapă cu AIza...)
  if (!GEMINI_API_KEY.startsWith('AIza')) {
    console.warn('⚠️ API key format may be invalid. Google API keys typically start with "AIza"');
  }
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Constante pentru validare și optimizare
const MAX_INLINE_REQUEST_SIZE_MB = 18; // 18MB pentru siguranță (limita e 20MB)
const MAX_IMAGE_SIZE_MB = 5; // Dimensiune recomandată per imagine
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

// Configurare compresie imagini pentru a reduce dimensiunea și tokenii consumați
// IMPORTANT: Gemini consumă tokeni bazat pe dimensiunea imaginii
// O imagine de 1MB poate consuma ~258 tokeni, deci 2 imagini mari = 500+ tokeni
// REDUCERE AGRESIVĂ pentru a evita 429 errors
const MAX_IMAGE_WIDTH = 512; // Redus la 512px (suficient pentru recunoaștere, dar mai puțini tokeni)
const MAX_IMAGE_HEIGHT = 512; // Redus la 512px
const COMPRESSION_QUALITY = 0.6; // 60% calitate (balanță între calitate și dimensiune)

// Cache pentru imagini procesate (evită procesarea dublă)
const imageCache = new Map<string, { data: string; mimeType: string; timestamp: number }>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minute

// Rate limiting pentru a evita erori 429 (Too Many Requests)
// Optimizat pentru gemini-2.0-flash-exp free tier
// FREE TIER LIMITS: 15 RPM (requests per minute) = 1 request per 4 seconds
let lastApiCallTime = 0;
const MIN_DELAY_BETWEEN_CALLS_MS = 4000; // 4 secunde între requests (safe pentru 15 RPM)

/**
 * Calculează dimensiunea în MB a unui string base64
 */
const calculateBase64SizeMB = (base64: string): number => {
  // Base64 folosește 4 caractere pentru a reprezenta 3 bytes
  // Dimensiunea în bytes = (lungime * 3) / 4
  const sizeInBytes = (base64.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  return sizeInMB;
};

/**
 * Comprimă și redimensionează o imagine pentru a reduce consumul de tokeni Gemini
 * CRITIC: Această funcție reduce dramatic dimensiunea imaginii și implicit tokenii consumați
 *
 * @param imageUri - URI-ul imaginii de comprimat
 * @returns URI-ul imaginii comprimate
 */
const compressImage = async (imageUri: string): Promise<string> => {
  try {
    console.log('🗜️ [compressImage] Starting image compression...');
    console.log('📸 [compressImage] Original URI:', imageUri);

    // Redimensionează imaginea la max 1024x1024 și comprimă la 70% calitate
    // Aceasta reduce DRAMATIC dimensiunea și tokenii consumați
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: MAX_IMAGE_WIDTH,
            height: MAX_IMAGE_HEIGHT,
          },
        },
      ],
      {
        compress: COMPRESSION_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG, // JPEG are compresie mai bună decât PNG
      }
    );

    console.log('✅ [compressImage] Compression complete');
    console.log('📁 [compressImage] Compressed URI:', manipResult.uri);
    console.log('📏 [compressImage] New dimensions:', manipResult.width, 'x', manipResult.height);

    return manipResult.uri;
  } catch (error) {
    console.error('❌ [compressImage] Error compressing image:', error);
    console.warn('⚠️ [compressImage] Falling back to original image');
    // Dacă compresia eșuează, returnează imaginea originală
    return imageUri;
  }
};

/**
 * Așteaptă pentru a respecta rate limiting (evită 429 errors)
 * CRITIC: Gemini API are limite stricte de RPM (Requests Per Minute)
 * FREE TIER: 15 RPM = 1 request per 4 seconds minimum
 */
const waitForRateLimit = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;

  if (timeSinceLastCall < MIN_DELAY_BETWEEN_CALLS_MS) {
    const waitTime = MIN_DELAY_BETWEEN_CALLS_MS - timeSinceLastCall;
    console.log(`⏱️ [waitForRateLimit] Last request was ${(timeSinceLastCall / 1000).toFixed(1)}s ago`);
    console.log(`⏱️ [waitForRateLimit] Waiting ${(waitTime / 1000).toFixed(1)}s to respect rate limit...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log(`⏱️ [waitForRateLimit] Last request was ${(timeSinceLastCall / 1000).toFixed(1)}s ago - OK to proceed`);
  }

  lastApiCallTime = Date.now();
  console.log('✅ [waitForRateLimit] Rate limit check complete, proceeding with API call');
};

/**
 * Curăță cache-ul de imagini expirate
 */
const cleanExpiredCache = (): void => {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.timestamp > CACHE_EXPIRY_MS) {
      imageCache.delete(key);
      console.log(`🗑️ [cleanExpiredCache] Removed expired cache entry for: ${key.substring(0, 50)}...`);
    }
  }
};

/**
 * Detectează tipul MIME al unei imagini din base64
 */
const detectImageMimeType = (base64: string): string => {
  // Verifică primii bytes din base64 (magic numbers) - conform standardelor Gemini
  const signatures: Record<string, string> = {
    '/9j/': 'image/jpeg',        // JPEG - suportat
    'iVBORw0KGgo': 'image/png',  // PNG - suportat
    'R0lGOD': 'image/gif',        // GIF - NU e suportat de Gemini
    'UklGR': 'image/webp',        // WEBP - suportat
    'Qk': 'image/bmp'             // BMP - NU e suportat de Gemini
  };

  for (const [signature, mimeType] of Object.entries(signatures)) {
    if (base64.startsWith(signature)) {
      // Verifică dacă tipul detectat e suportat de Gemini
      if (!SUPPORTED_MIME_TYPES.includes(mimeType as any)) {
        console.warn(`⚠️ [detectImageMimeType] Detected type ${mimeType} is NOT supported by Gemini Vision API`);
        console.warn(`⚠️ [detectImageMimeType] Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`);
        return 'image/jpeg'; // Fallback la JPEG (cel mai comun)
      }
      return mimeType;
    }
  }

  // Default la JPEG dacă nu putem detecta
  console.warn('⚠️ [detectImageMimeType] Could not detect image type, defaulting to image/jpeg');
  console.warn('⚠️ [detectImageMimeType] First 20 chars of base64:', base64.substring(0, 20));
  return 'image/jpeg';
};

/**
 * Validează că un string base64 este valid și reprezintă o imagine
 * Conform standardelor Gemini Vision API
 */
const validateBase64Image = (base64: string): { isValid: boolean; error?: string; mimeType?: string; sizeMB?: number } => {
  try {
    // 1. Verifică că nu e gol
    if (!base64 || base64.trim().length === 0) {
      return { isValid: false, error: 'Base64 string is empty' };
    }

    // 2. Curăță base64-ul (elimină spațiile și line breaks)
    const cleanBase64 = base64.replace(/\s/g, '');

    // 3. Verifică lungimea minimă (o imagine mică ar avea măcar câteva KB)
    if (cleanBase64.length < 100) {
      return { isValid: false, error: 'Base64 string too short to be a valid image' };
    }

    // 4. Verifică caracterele valide base64
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(cleanBase64)) {
      return { isValid: false, error: 'Base64 contains invalid characters' };
    }

    // 5. Verifică lungimea (trebuie să fie multiplu de 4 după adăugarea padding-ului)
    const paddedLength = Math.ceil(cleanBase64.length / 4) * 4;
    const paddedBase64 = cleanBase64.padEnd(paddedLength, '=');

    // 6. Detectează tipul imaginii
    const mimeType = detectImageMimeType(cleanBase64);

    // 7. Calculează dimensiunea în MB
    const sizeMB = calculateBase64SizeMB(cleanBase64);

    // 8. Verifică dacă imaginea depășește dimensiunea recomandată
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
      console.warn(`⚠️ [validateBase64Image] Image size (${sizeMB.toFixed(2)}MB) exceeds recommended limit (${MAX_IMAGE_SIZE_MB}MB)`);
      console.warn('⚠️ [validateBase64Image] Consider compressing the image before sending to Gemini API');
      // Nu eșuăm validarea, dar afișăm warning pentru că ar putea cauza erori API
    }

    // 9. Verifică signature-ul imaginii (doar pentru formate suportate de Gemini)
    const validSignatures = ['/9j/', 'iVBORw0KGgo', 'UklGR']; // JPEG, PNG, WEBP
    const hasValidSignature = validSignatures.some(sig => cleanBase64.startsWith(sig));

    if (!hasValidSignature) {
      console.warn('⚠️ [validateBase64Image] Base64 does not start with Gemini-supported image signature');
      console.warn('⚠️ [validateBase64Image] First 20 chars:', cleanBase64.substring(0, 20));
      console.warn('⚠️ [validateBase64Image] Supported formats: JPEG, PNG, WEBP, HEIC, HEIF');
      // Nu eșuăm validarea, dar afișăm warning
    }

    console.log('✅ [validateBase64Image] Validation passed');
    console.log('📊 [validateBase64Image] Base64 length:', cleanBase64.length, 'chars');
    console.log('📏 [validateBase64Image] Image size:', sizeMB.toFixed(2), 'MB');
    console.log('🎨 [validateBase64Image] Detected MIME type:', mimeType);

    return { isValid: true, mimeType, sizeMB };
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error}` };
  }
};

/**
 * Convertește URI-ul imaginii în format base64 cu caching și compresie
 * IMPORTANT: Compresia reduce dramatic consumul de tokeni Gemini
 */
const imageToBase64 = async (imageUri: string): Promise<{ data: string; mimeType: string }> => {
  try {
    // Verifică cache-ul
    cleanExpiredCache(); // Curăță cache-ul înainte de a verifica
    const cachedImage = imageCache.get(imageUri);
    if (cachedImage) {
      console.log('💾 [imageToBase64] Using cached image for URI:', imageUri.substring(0, 50) + '...');
      console.log('📏 [imageToBase64] Cached image size:', calculateBase64SizeMB(cachedImage.data).toFixed(2), 'MB');
      return { data: cachedImage.data, mimeType: cachedImage.mimeType };
    }

    console.log('📄 [imageToBase64] Converting image to base64, URI:', imageUri);

    // PASUL 1: Comprimă imaginea pentru a reduce tokenii consumați
    const compressedUri = await compressImage(imageUri);

    // PASUL 2: Convertește imaginea comprimată în base64
    const file = new File(compressedUri);
    let base64 = await file.base64();

    // Curăță base64-ul de orice spații sau caractere speciale
    base64 = base64.replace(/\s/g, '');

    console.log('✅ [imageToBase64] Conversion successful, length:', base64.length);

    // Validează base64-ul conform standardelor Gemini
    const validation = validateBase64Image(base64);
    if (!validation.isValid) {
      throw new Error(`Invalid base64 image: ${validation.error}`);
    }

    const mimeType = validation.mimeType || 'image/jpeg';
    const sizeMB = validation.sizeMB || 0;

    console.log('🎨 [imageToBase64] Detected MIME type:', mimeType);
    console.log('📏 [imageToBase64] Image size:', sizeMB.toFixed(2), 'MB');

    // Verifică dacă imaginea depășește limita recomandată pentru Gemini
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
      console.warn(`⚠️ [imageToBase64] Image size ${sizeMB.toFixed(2)}MB exceeds recommended ${MAX_IMAGE_SIZE_MB}MB`);
      console.warn('⚠️ [imageToBase64] This may cause API errors or slow performance');
    }

    // Salvează în cache pentru utilizare viitoare
    imageCache.set(imageUri, { data: base64, mimeType, timestamp: Date.now() });
    console.log('💾 [imageToBase64] Image cached for future use');

    return { data: base64, mimeType };
  } catch (error) {
    console.error('❌ [imageToBase64] Error converting image to base64:', error);
    console.error('❌ [imageToBase64] URI was:', imageUri);
    throw new Error('Nu s-a putut procesa imaginea');
  }
};

/**
 * Descarcă imagine de la un URL și o convertește în base64 cu caching
 */
const downloadImageToBase64 = async (imageUrl: string): Promise<{ data: string; mimeType: string }> => {
  try {
    // Verifică cache-ul
    cleanExpiredCache();
    const cachedImage = imageCache.get(imageUrl);
    if (cachedImage) {
      console.log('💾 [downloadImageToBase64] Using cached image for URL:', imageUrl.substring(0, 60) + '...');
      console.log('📏 [downloadImageToBase64] Cached image size:', calculateBase64SizeMB(cachedImage.data).toFixed(2), 'MB');
      return { data: cachedImage.data, mimeType: cachedImage.mimeType };
    }

    console.log('🌐 [downloadImageToBase64] Fetching image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    console.log('📡 [downloadImageToBase64] Fetch response status:', response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobSizeMB = blob.size / (1024 * 1024);
    console.log('📦 [downloadImageToBase64] Blob received, size:', blobSizeMB.toFixed(2), 'MB, type:', blob.type);

    // Verifică că blob-ul are dimensiune validă
    if (blob.size === 0) {
      throw new Error('Downloaded image is empty (0 bytes)');
    }

    // Verifică că este un tip de imagine valid pentru Gemini
    if (!blob.type.startsWith('image/')) {
      console.warn('⚠️ [downloadImageToBase64] Blob type is not an image:', blob.type);
    } else if (!SUPPORTED_MIME_TYPES.includes(blob.type as any)) {
      console.warn('⚠️ [downloadImageToBase64] Blob type may not be supported by Gemini:', blob.type);
      console.warn('⚠️ [downloadImageToBase64] Supported types:', SUPPORTED_MIME_TYPES.join(', '));
    }

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Elimină prefixul "data:image/jpeg;base64," și curăță string-ul
        const base64Data = base64String.split(',')[1].replace(/\s/g, '');
        console.log('✅ [downloadImageToBase64] Image converted to base64, length:', base64Data.length);
        resolve(base64Data);
      };
      reader.onerror = (error) => {
        console.error('❌ [downloadImageToBase64] FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });

    // Validează base64-ul conform standardelor Gemini
    const validation = validateBase64Image(base64Data);
    if (!validation.isValid) {
      throw new Error(`Downloaded image has invalid base64: ${validation.error}`);
    }

    // Folosește tipul MIME din blob sau cel detectat
    const mimeType = blob.type || validation.mimeType || 'image/jpeg';
    const sizeMB = validation.sizeMB || 0;

    console.log('🎨 [downloadImageToBase64] Final MIME type:', mimeType);
    console.log('📏 [downloadImageToBase64] Image size:', sizeMB.toFixed(2), 'MB');

    // Verifică dacă imaginea depășește limita recomandată
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
      console.warn(`⚠️ [downloadImageToBase64] Downloaded image size ${sizeMB.toFixed(2)}MB exceeds recommended ${MAX_IMAGE_SIZE_MB}MB`);
      console.warn('⚠️ [downloadImageToBase64] This may cause API errors or slow performance');
    }

    // Salvează în cache
    imageCache.set(imageUrl, { data: base64Data, mimeType, timestamp: Date.now() });
    console.log('💾 [downloadImageToBase64] Image cached for future use');

    return { data: base64Data, mimeType };
  } catch (error) {
    console.error('❌ [downloadImageToBase64] Error downloading image:', error);
    console.error('❌ [downloadImageToBase64] URL was:', imageUrl);
    throw new Error('Nu s-a putut descărca imaginea de referință');
  }
};

/**
 * Retry logic cu exponential backoff pentru apeluri API Gemini
 * Include și rate limiting pentru a evita 429 errors
 * 
 * IMPORTANT: Dacă primim 429 pe prima încercare, înseamnă că API-ul are
 * propriile limite interne care sunt mai stricte decât rate limiting-ul nostru
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 2, // Redus la 2 (total 3 încercări cu prima)
  baseDelay: number = 10000 // 10 secunde base delay pentru free tier
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Așteaptă pentru rate limiting înainte de fiecare apel
      await waitForRateLimit();

      console.log(`🚀 [retryWithBackoff] Attempting API call (attempt ${attempt + 1}/${maxRetries})...`);
      const result = await fn();
      console.log(`✅ [retryWithBackoff] API call successful on attempt ${attempt + 1}`);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Log detaliat pentru debugging
      console.error(`❌ [retryWithBackoff] Error on attempt ${attempt + 1}/${maxRetries}`);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        response: error.response,
        // Log întregul error pentru debugging
        fullError: JSON.stringify(error, null, 2)
      });

      // Nu reîncearcă pentru erori de validare (400, 404)
      if (error.message?.includes('400') || error.message?.includes('404')) {
        console.error(`❌ [retryWithBackoff] Non-retryable error (attempt ${attempt + 1}/${maxRetries}):`, error.message);
        throw error;
      }

      // Pentru eroare 429, așteaptă mult mai mult (free tier are limite stricte)
      if (error.message?.includes('429')) {
        console.error(`❌ [retryWithBackoff] Rate limit exceeded (429) on attempt ${attempt + 1}/${maxRetries}`);
        
        // Dacă primim 429 chiar pe prima încercare, înseamnă că am depășit limita zilnică sau minutară
        if (attempt === 0) {
          console.error('⚠️ [retryWithBackoff] 429 on FIRST attempt - you may have exceeded daily/minute quota');
          console.error('⚠️ [retryWithBackoff] Free tier limits: 15 requests/minute, 1500 requests/day');
        }
        
        if (attempt < maxRetries - 1) {
          // Delay crescut dramatic: 20s, 60s
          const delay = 20000 * Math.pow(3, attempt);
          console.warn(`⚠️ [retryWithBackoff] Waiting ${delay / 1000}s before retry due to rate limit...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        continue;
      }

      // Dacă mai avem încercări, așteaptă înainte de retry
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // 10s, 20s
        console.warn(`⚠️ [retryWithBackoff] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay / 1000}s...`);
        console.warn(`⚠️ [retryWithBackoff] Error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`❌ [retryWithBackoff] All ${maxRetries} attempts failed`);
  throw lastError!;
};

/**
 * Compară imaginea utilizatorului cu o imagine de referință folosind Gemini Vision AI
 *
 * Optimizări implementate:
 * - Caching pentru imagini procesate (evită conversii duplicate)
 * - Validare dimensiune conform limite API (20MB total request)
 * - Retry logic cu exponential backoff pentru erori temporare
 * - Verificare formate suportate (JPEG, PNG, WEBP, HEIC, HEIF)
 * - Logging detaliat pentru debugging
 *
 * @param userImageUri - URI-ul imaginii capturate de utilizator
 * @param referenceImageUrl - URL-ul imaginii de referință din ImageQuest
 * @param questDescription - Descrierea obiectului/locației de căutat
 * @returns Rezultatul comparației cu nivel de încredere
 */
export const compareImages = async (
  userImageUri: string,
  referenceImageUrl: string,
  questDescription: string
): Promise<ImageComparisonResult> => {
  try {
    console.log('🤖 [compareImages] Starting image comparison with Gemini AI...');
    console.log('📸 [compareImages] User image URI:', userImageUri);
    console.log('🖼️ [compareImages] Reference image URL:', referenceImageUrl);
    console.log('📝 [compareImages] Quest description:', questDescription);
    console.log('⏱️ [compareImages] Current timestamp:', new Date().toISOString());

    // Folosește modelul gemini-2.5-flash - cel mai nou și performant model
    // Acest model are performanțe superioare și 4M TPM (vs 1M pentru versiunile vechi)
    console.log('🔧 [compareImages] Initializing Gemini 2.5 Flash model...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Convertește ambele imagini în base64
    console.log('🔄 [compareImages] Converting user image to base64...');
    const userImage = await imageToBase64(userImageUri);
    console.log('✅ [compareImages] User image converted, length:', userImage.data.length);
    console.log('🎨 [compareImages] User image MIME type:', userImage.mimeType);

    // Descarcă și convertește imaginea de referință
    let referenceImage: { data: string; mimeType: string };
    if (referenceImageUrl.startsWith('http')) {
      console.log('🌐 [compareImages] Downloading reference image from URL...');
      referenceImage = await downloadImageToBase64(referenceImageUrl);
      console.log('✅ [compareImages] Reference image downloaded and converted, length:', referenceImage.data.length);
      console.log('🎨 [compareImages] Reference image MIME type:', referenceImage.mimeType);
    } else {
      console.log('📁 [compareImages] Converting local reference image to base64...');
      referenceImage = await imageToBase64(referenceImageUrl);
      console.log('✅ [compareImages] Reference image converted, length:', referenceImage.data.length);
      console.log('🎨 [compareImages] Reference image MIME type:', referenceImage.mimeType);
    }

    // Verifică dimensiunea totală a request-ului (conform limite 20MB Gemini API)
    const totalSizeMB = calculateBase64SizeMB(referenceImage.data) + calculateBase64SizeMB(userImage.data);
    console.log('📏 [compareImages] Total request size:', totalSizeMB.toFixed(2), 'MB');

    if (totalSizeMB > MAX_INLINE_REQUEST_SIZE_MB) {
      console.error(`❌ [compareImages] Total request size ${totalSizeMB.toFixed(2)}MB exceeds limit ${MAX_INLINE_REQUEST_SIZE_MB}MB`);
      throw new Error(`Imaginile sunt prea mari (${totalSizeMB.toFixed(2)}MB). Limita este ${MAX_INLINE_REQUEST_SIZE_MB}MB.`);
    }

    // Prompt optimizat pentru a reduce consumul de tokeni
    const prompt = `Compare these images. Do they show the same: ${questDescription}?
Accept different angles, lighting, partial views.

Respond with ONLY this JSON (no extra text):
{"isMatch": boolean, "confidence": 0-100, "reasoning": "brief explanation"}`;

    console.log('📤 [compareImages] Sending request to Gemini AI...');
    console.log('📊 [compareImages] Request details:');
    console.log('   - Reference image size:', calculateBase64SizeMB(referenceImage.data).toFixed(2), 'MB, type:', referenceImage.mimeType);
    console.log('   - User image size:', calculateBase64SizeMB(userImage.data).toFixed(2), 'MB, type:', userImage.mimeType);
    console.log('   - Total size:', totalSizeMB.toFixed(2), 'MB');

    // Înfășoară apelul API în retry logic cu exponential backoff
    const result = await retryWithBackoff(async () => {
      // Generează răspunsul cu ambele imagini (folosind tipul MIME corect detectat)
      // Ordinea: prompt, imagine referință, imagine utilizator
      return await model.generateContent([
        prompt,
        {
          inlineData: {
            data: referenceImage.data,
            mimeType: referenceImage.mimeType,
          },
        },
        {
          inlineData: {
            data: userImage.data,
            mimeType: userImage.mimeType,
          },
        },
      ]);
    }, 2, 10000); // Max 2 retries (3 total attempts), 10s base delay

    console.log('📥 [compareImages] Received response from Gemini AI');
    const response = result.response;
    const text = response.text();
    console.log('📄 [compareImages] Response text:', text);

    // Extrage JSON-ul din răspuns
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ [compareImages] Invalid response format - no JSON found in response');
      throw new Error('Format de răspuns invalid de la Gemini AI');
    }

    console.log('🔍 [compareImages] Parsing JSON from response...');
    const comparisonData = JSON.parse(jsonMatch[0]);
    console.log('✅ [compareImages] Parsed comparison data:', comparisonData);

    const finalResult = {
      isMatch: comparisonData.isMatch,
      confidence: comparisonData.confidence,
      reasoning: comparisonData.reasoning,
    };

    console.log('🎉 [compareImages] Image comparison complete!');
    console.log('📊 [compareImages] Final result:', finalResult);

    return finalResult;
  } catch (error: any) {
    console.error('❌ [compareImages] Error during image comparison:', error);
    console.error('❌ [compareImages] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    // Handling specific al erorilor API
    if (error.message?.includes('400')) {
      console.error('❌ [compareImages] Bad Request (400) - invalid image data or format');
      throw new Error('Imaginea nu are un format valid pentru procesare. Te rog încearcă cu o altă imagine.');
    }

    if (error.message?.includes('404')) {
      console.error('❌ [compareImages] Model not found (404) - check model name');
      throw new Error('Modelul AI nu este disponibil. Te rog încearcă mai târziu.');
    }

    if (error.message?.includes('429')) {
      console.error('❌ [compareImages] Rate limit exceeded (429)');
      console.error('📊 [compareImages] Possible causes:');
      console.error('   1. Exceeded 15 requests per minute (wait 1 minute)');
      console.error('   2. Exceeded 1,500 requests per day (wait until tomorrow)');
      console.error('   3. API key may be restricted or quota exceeded');
      console.error('   4. Check your quota at: https://aistudio.google.com/app/apikey');
      throw new Error('Ai atins limita de cereri pentru AI. Verifică quota la https://aistudio.google.com/app/apikey sau așteaptă 1 minut.');
    }

    if (error.message?.includes('500') || error.message?.includes('503')) {
      console.error('❌ [compareImages] Server error (500/503)');
      throw new Error('Serviciul AI este temporar indisponibil. Te rog încearcă din nou.');
    }

    // Eroare generică
    throw new Error('Nu s-au putut compara imaginile. Te rog încearcă din nou.');
  }
};
