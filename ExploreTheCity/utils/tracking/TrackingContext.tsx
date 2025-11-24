import type { LatLng } from "@/domain/geo/grid";
import { cellCenter } from "@/domain/geo/grid";
import { syncBatchToFirebase } from "@/domain/tracking/sync";
import {
  createInitialTrackingState,
  handleLocationUpdate,
  type TrackingState,
} from "@/domain/tracking/tracker";
import { useAuth } from "@/utils/firebase/AuthContext";
import { db } from "@/utils/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";

type TrackingContextType = {
  trackingState: TrackingState;
  visitedCellsLocations: LatLng[];
  onLocationUpdate: (newLoc: LatLng) => void;
  flushBuffer: () => void;
};

const TrackingContext = createContext<TrackingContextType | undefined>(
  undefined
);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [trackingState, setTrackingState] = useState<TrackingState>(() =>
    createInitialTrackingState()
  );

  const [visitedCellsLocations, setVisitedCellsLocations] = useState<LatLng[]>(
    []
  );

  const { user } = useAuth();
  const clientIdRef = useRef<string | undefined>(undefined);

  // reținem pt ce user am încărcat ultima dată
  const lastLoadedUserIdRef = useRef<string | null>(null);

  const pendingCellsRef = useRef<string[]>([]);
  const pendingPointsRef = useRef<number>(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    clientIdRef.current = user?.uid ?? undefined;
  }, [user]);

  // 🔹 reset + load când se schimbă user-ul
  useEffect(() => {
    const loadFromBackend = async (uid: string) => {
      try {
        const clientRef = doc(db, "clients", uid);
        const snap = await getDoc(clientRef);

        if (!snap.exists()) {
          console.log(
            "[TRACKING] Niciun document client existent pentru acest user."
          );
          return;
        }

        const data = snap.data() as any;
        const mapGridIds: string[] = data.mapGridIds ?? [];
        const accumulatedScore: number =
          typeof data.accumulatedScore === "number"
            ? data.accumulatedScore
            : 0;

        console.log(
          "[TRACKING] Loaded from backend:",
          mapGridIds.length,
          "celule vizitate, scor:",
          accumulatedScore
        );

        setTrackingState((prev) => {
          const mergedVisited = new Set<string>(prev.visitedCells);
          for (const id of mapGridIds) {
            mergedVisited.add(id);
          }

          return {
            ...createInitialTrackingState(), // pornim curat
            points: accumulatedScore,
            visitedCells: mergedVisited,
          };
        });

        setVisitedCellsLocations(() => {
          const centers: LatLng[] = mapGridIds.map((cellId) =>
            cellCenter(cellId)
          );
          return centers;
        });
      } catch (err) {
        console.error("[TRACKING] Eroare la loadFromBackend:", err);
      }
    };

    // user delogat -> reset complet
    if (!user?.uid) {
      console.log("[TRACKING] User logged out, resetăm state-ul de tracking.");
      lastLoadedUserIdRef.current = null;
      pendingCellsRef.current = [];
      pendingPointsRef.current = 0;
      setTrackingState(createInitialTrackingState());
      setVisitedCellsLocations([]);
      return;
    }

    // user nou sau alt uid decât înainte
    if (lastLoadedUserIdRef.current !== user.uid) {
      console.log("[TRACKING] User schimbat, încărcăm progresul din backend.");
      lastLoadedUserIdRef.current = user.uid;

      // resetăm local înainte să încărcăm din backend
      pendingCellsRef.current = [];
      pendingPointsRef.current = 0;
      setTrackingState(createInitialTrackingState());
      setVisitedCellsLocations([]);

      loadFromBackend(user.uid);
    }
  }, [user]);

  const flushBuffer = useCallback(() => {
    if (
      pendingCellsRef.current.length === 0 &&
      pendingPointsRef.current === 0
    ) {
      return;
    }

    const clientId = clientIdRef.current;
    if (!clientId) {
      console.warn("[FLUSH] clientId lipsă, nu trimit la backend");
      return;
    }

    const cellsToSync = [...new Set(pendingCellsRef.current)];
    const pointsToSync = pendingPointsRef.current;

    pendingCellsRef.current = [];
    pendingPointsRef.current = 0;

    console.log(
      "[FLUSH] Trimit la backend:",
      cellsToSync.length,
      "celule unice:",
      cellsToSync,
      "și",
      pointsToSync,
      "puncte pentru clientId:",
      clientId
    );

    syncBatchToFirebase(clientId, cellsToSync, pointsToSync).catch((err) => {
      console.error("[SYNC] Eroare la syncBatchToFirebase:", err);
    });
  }, []);

  // AppState: când mergem în background, facem flush
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current === "active" && nextState === "background") {
        console.log("[APPSTATE] Mergem în background, flush buffer...");
        flushBuffer();
      }

      appState.current = nextState;
    });

    return () => {
      sub.remove();
    };
  }, [flushBuffer]);

  const onLocationUpdate = useCallback((newLoc: LatLng) => {
    setTrackingState((prevState) => {
      const result = handleLocationUpdate(prevState, newLoc);

      if (result.newCellVisited) {
        const center = cellCenter(result.lastCellId);

        setVisitedCellsLocations((prev) => {
          if (!prev.some((loc) => loc.lat === center.lat && loc.lng === center.lng)) {
            return [...prev, center];
          }
          return prev;
        });

        if (!pendingCellsRef.current.includes(result.lastCellId)) {
          pendingCellsRef.current.push(result.lastCellId);
        }
      }

      pendingPointsRef.current += result.gainedPoints;

      if (pendingCellsRef.current.length >= 10) {
        const clientId = clientIdRef.current;
        if (clientId) {
          const cellsToSync = [...new Set(pendingCellsRef.current)];
          const pointsToSync = pendingPointsRef.current;

          pendingCellsRef.current = [];
          pendingPointsRef.current = 0;

          console.log(
            "[FLUSH AUTO] Trimit la backend:",
            cellsToSync.length,
            "celule,",
            pointsToSync,
            "puncte"
          );

          syncBatchToFirebase(clientId, cellsToSync, pointsToSync).catch(
            (err) => {
              console.error("[SYNC AUTO] Eroare:", err);
            }
          );
        }
      }

      console.log("Total points (local):", result.state.points);
      console.log(
        "Buffer acum:",
        pendingCellsRef.current.length,
        "celule,",
        pendingPointsRef.current,
        "puncte"
      );

      return result.state;
    });
  }, []);

  const value: TrackingContextType = {
    trackingState,
    visitedCellsLocations,
    onLocationUpdate,
    flushBuffer,
  };

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error("useTracking must be used within a TrackingProvider");
  }
  return context;
}
