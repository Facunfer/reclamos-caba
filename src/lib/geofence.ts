// src/lib/geofence.ts

export interface Point {
    lat: number;
    lng: number;
}

/**
 * Basic ray-casting algorithm for point-in-polygon.
 * Returns true if point is inside polygon.
 * polygon is an array of [lng, lat] (standard GeoJSON format)
 */
export function isPointInPolygon(point: Point, polygon: number[][][]) {
    const x = point.lng;
    const y = point.lat;
    let inside = false;

    // A polygon in GeoJSON is number[][][] (array of rings)
    // We iterate through each ring (exterior and holes)
    // For a point to be "inside", it must be inside the exterior ring 
    // AND NOT inside any of the holes.
    // Simplifying: we'll check the exterior ring (index 0).
    const ring = polygon[0];

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];

        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if point is inside any of the polygons in a MultiPolygon
 */
export function isPointInMultiPolygon(point: Point, multiPolygon: number[][][][]) {
    return multiPolygon.some((polygon) => isPointInPolygon(point, polygon));
}

let comunasGeoJSON: any = null;
let barriosGeoJSON: any = null;

const COMUNAS_URL = "/api/comunas";
const BARRIOS_URL = "/api/barrios";

export async function fetchComunasGeoJSON() {
    if (comunasGeoJSON) return comunasGeoJSON;
    try {
        const res = await fetch(COMUNAS_URL);
        if (!res.ok) throw new Error("Failed to fetch comunas GeoJSON");
        comunasGeoJSON = await res.json();
        return comunasGeoJSON;
    } catch (err) {
        console.error("Geofence error (comunas):", err);
        return null;
    }
}

export async function fetchBarriosGeoJSON() {
    if (barriosGeoJSON) return barriosGeoJSON;
    try {
        const res = await fetch(BARRIOS_URL);
        if (!res.ok) throw new Error("Failed to fetch barrios GeoJSON");
        barriosGeoJSON = await res.json();
        return barriosGeoJSON;
    } catch (err) {
        console.error("Geofence error (barrios):", err);
        return null;
    }
}

/**
 * Determines which comuna a point belongs to.
 * Returns the COMUNA property (usually 1-15).
 */
export function getComunaForPoint(point: Point, geojson: any): number | null {
    if (!geojson || !geojson.features) return null;

    for (const feature of geojson.features) {
        const geometry = feature.geometry;
        const props = feature.properties;

        // Properties might vary
        const comunaId = props.COMUNA || props.comuna || props.ID || props.id;

        if (geometry.type === "Polygon") {
            if (isPointInPolygon(point, geometry.coordinates)) return Number(comunaId);
        } else if (geometry.type === "MultiPolygon") {
            if (isPointInMultiPolygon(point, geometry.coordinates)) return Number(comunaId);
        }
    }

    return null;
}

/**
 * Determines which neighborhood a point belongs to.
 * Returns the BARRIO property name.
 */
export function getBarrioForPoint(point: Point, geojson: any): string | null {
    if (!geojson || !geojson.features) return null;

    for (const feature of geojson.features) {
        const geometry = feature.geometry;
        const props = feature.properties;

        // Property is usually "BARRIO", "barrio", "NOMBRE" or "nombre"
        const barrioName = props.nombre || props.BARRIO || props.barrio || props.NOMBRE;

        if (geometry.type === "Polygon") {
            if (isPointInPolygon(point, geometry.coordinates)) return String(barrioName);
        } else if (geometry.type === "MultiPolygon") {
            if (isPointInMultiPolygon(point, geometry.coordinates)) return String(barrioName);
        }
    }

    return null;
}
