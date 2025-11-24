/**
 * Firebase Configuration Checker
 * Run this to verify your Firebase setup
 *
 * Usage: node scripts/check-firebase-config.js
 */

require('dotenv').config();

console.log("=== Firebase Configuration Check ===\n");

const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

let allPresent = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  console.log(`${status} ${varName}: ${value ? '(set)' : '(MISSING)'}`);
  if (!value) allPresent = false;
});

console.log("\n=== Storage Configuration ===");
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
if (storageBucket) {
  console.log(`✅ Storage Bucket: ${storageBucket}`);
  if (storageBucket.includes('.firebasestorage.app') || storageBucket.includes('.appspot.com')) {
    console.log("✅ Storage bucket format looks correct");
  } else {
    console.log("⚠️  Storage bucket format might be incorrect");
    console.log("   Expected format: project-id.firebasestorage.app");
  }
} else {
  console.log("❌ FIREBASE_STORAGE_BUCKET is not set!");
}

console.log("\n=== Summary ===");
if (allPresent) {
  console.log("✅ All Firebase environment variables are configured!");
  console.log("\n📋 Next Steps:");
  console.log("1. Go to Firebase Console: https://console.firebase.google.com/");
  console.log("2. Select your project: walkwithme-1");
  console.log("3. Click Storage → Get Started (if needed)");
  console.log("4. Update Storage Rules to allow uploads");
  console.log("5. Restart your Expo app");
} else {
  console.log("❌ Some Firebase environment variables are missing!");
  console.log("   Check your .env file and update it with the correct values.");
}

console.log("\n=== Storage Rules ===");
console.log("Copy this to Firebase Console → Storage → Rules:");
console.log(`
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
`);
