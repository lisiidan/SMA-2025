// domain/geo/grid.ts

// Reprezentăm o locație prin latitudine și longitudine
export type LatLng = {
  lat: number;
  lng: number;
};

export type CellId = string; // de forma "x_y"

// Dimensiunea unei celule în metri (50x50m)
export const CELL_SIZE_METERS = 50;

// Punct de referință pentru oraș (centrul Timișoarei, aproximativ)
export const ORIGIN: LatLng = {
  lat: 45.75372,
  lng: 21.22571,
};

const METERS_PER_DEG_LAT = 111_320; // aproximativ constant

function metersPerDegLng(lat: number): number {
  // la ecuator e ~111_320 m/deg, scade cu cos(lat)
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

export function latLngToCell(location: LatLng): CellId {
  // diferența față de origine, în grade
  const dLat = location.lat - ORIGIN.lat;
  const dLng = location.lng - ORIGIN.lng;

  // convertim grade -> metri
  const mPerDegLng = metersPerDegLng(ORIGIN.lat);
  const xMeters = dLng * mPerDegLng;
  const yMeters = dLat * METERS_PER_DEG_LAT;

  // indexul celulei (50m per celulă)
  const xIndex = Math.floor(xMeters / CELL_SIZE_METERS);
  const yIndex = Math.floor(yMeters / CELL_SIZE_METERS);

  // construim un id simplu de forma "x_y"
  return `${xIndex}_${yIndex}`;
}

// Transformă o poziție (x, y în metri față de ORIGIN) în lat/lng
function metersToLatLng(xMeters: number, yMeters: number): LatLng {
  const dLat = yMeters / METERS_PER_DEG_LAT;
  const mPerDegLng = metersPerDegLng(ORIGIN.lat);
  const dLng = xMeters / mPerDegLng;

  return {
    lat: ORIGIN.lat + dLat,
    lng: ORIGIN.lng + dLng,
  };
}

// Centrul geografic al unei celule (pentru desenare sau debugging)
export function cellCenter(cellId: CellId): LatLng {
  const [xStr, yStr] = cellId.split("_");
  const xIndex = parseInt(xStr, 10);
  const yIndex = parseInt(yStr, 10);

  const xCenterMeters = (xIndex + 0.5) * CELL_SIZE_METERS;
  const yCenterMeters = (yIndex + 0.5) * CELL_SIZE_METERS;

  return metersToLatLng(xCenterMeters, yCenterMeters);
}

// Colțurile unui pătrat 50x50m pentru o celulă (NW, NE, SE, SW)
export function cellToPolygon(cellId: CellId): LatLng[] {
  const [xStr, yStr] = cellId.split("_");
  const xIndex = parseInt(xStr, 10);
  const yIndex = parseInt(yStr, 10);

  const half = CELL_SIZE_METERS / 2;

  const xCenter = (xIndex + 0.5) * CELL_SIZE_METERS;
  const yCenter = (yIndex + 0.5) * CELL_SIZE_METERS;

  const cornersMeters = [
    { x: xCenter - half, y: yCenter + half }, // NW
    { x: xCenter + half, y: yCenter + half }, // NE
    { x: xCenter + half, y: yCenter - half }, // SE
    { x: xCenter - half, y: yCenter - half }, // SW
  ];

  return cornersMeters.map((p) => metersToLatLng(p.x, p.y));
}
