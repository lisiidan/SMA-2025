// domain/tracking/sync.ts

import { doc, setDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/utils/firebase/config";

export async function syncBatchToFirebase(
  clientId: string,
  cellIds: string[],
  gainedPoints: number
) {
  if (!clientId) {
    console.warn("[SYNC] clientId lipsă, sar peste sync");
    return;
  }

  if (cellIds.length === 0 && gainedPoints <= 0) {
    return; // nimic util de trimis
  }

  const clientRef = doc(db, "clients", clientId);

  const data: any = {};

  const roundedPoints = Math.round(gainedPoints);
  if (roundedPoints !== 0) {
    data.accumulatedScore = increment(roundedPoints);
  }

  if (cellIds.length > 0) {
    data.mapGridIds = arrayUnion(...cellIds);
  }

  console.log("[SYNC] Trimit la Firestore:", data);

  await setDoc(clientRef, data, { merge: true });
}
