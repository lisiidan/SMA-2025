// domain/tracking/tracker.ts

import type { LatLng, CellId } from "../geo/grid";
import { latLngToCell } from "../geo/grid";
import { haversineDistance } from "../geo/distance";

// Starea user-ului care se plimbă prin oraș
export type TrackingState = {
  lastLocation?: LatLng;
  totalDistanceMeters: number;
  points: number;
  visitedCells: Set<CellId>;
};

// helper pentru state inițial
export function createInitialTrackingState(): TrackingState {
  return {
    lastLocation: undefined,
    totalDistanceMeters: 0,
    points: 0,
    visitedCells: new Set<CellId>(),
  };
}

export type LocationUpdateResult = {
  state: TrackingState;
  gainedDistance: number;
  gainedPoints: number;
  newCellVisited: boolean;
  lastCellId: CellId;
};

// procesează un nou punct GPS
export function handleLocationUpdate(
  prevState: TrackingState,
  newLocation: LatLng
): LocationUpdateResult {
  // clonăm visitedCells ca să nu modificăm direct obiectul vechi
  const state: TrackingState = {
    ...prevState,
    visitedCells: new Set(prevState.visitedCells),
  };

  let gainedDistance = 0;
  let gainedPoints = 0;
  let newCellVisited = false;

  // 1) distanța față de ultima locație
  if (state.lastLocation) {
    const dist = haversineDistance(state.lastLocation, newLocation);

    // mic filtru anti-zgomot (GPS sare 1–2m chiar dacă stai pe loc)
    if (dist > 3) {
      state.totalDistanceMeters += dist;
      gainedDistance = dist;

      // exemplu: 0.1 puncte per metru
      gainedPoints += dist * 0.1;
    }
  }

  // 2) celula curentă + bonus dacă e nouă
  const cellId = latLngToCell(newLocation);
  const alreadyHad = state.visitedCells.has(cellId);

  if (!alreadyHad) {
    state.visitedCells.add(cellId);
    newCellVisited = true;
    gainedPoints += 50;
  }

  // 3) actualizăm ultima locație și totalul de puncte
  state.lastLocation = newLocation;
  state.points += gainedPoints;

  return {
    state,
    gainedDistance,
    gainedPoints,
    newCellVisited,
    lastCellId: cellId,
  };
}
