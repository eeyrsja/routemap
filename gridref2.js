// gridref2.js
import OsGridRef from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';

let waypointCount = 0;
let map;

export function addWaypoint() {
    waypointCount++;
    const waypointDiv = document.createElement("div");
    waypointDiv.className = "form-group";
    waypointDiv.innerHTML = `
        <input type="text" id="waypoint-${waypointCount}" oninput="updateLatLon('waypoint-${waypointCount}')" placeholder="e.g., SO 600 100">
        <span id="waypoint-${waypointCount}-coords"></span>
    `;
    document.getElementById("waypoint-inputs").appendChild(waypointDiv);
}

// Convert OS Grid Reference to Lat/Lon
export function osGridToLatLon(gridrefStr) {
    console.log(`Converting OS Grid Reference: ${gridrefStr}`);
    try {
        const gridref = OsGridRef.parse(gridrefStr);
        const wgs84 = gridref.toLatLon();
        console.log(`Converted to Lat/Lon:`, [wgs84.lat, wgs84.lon]); // Log successful conversion
        return [wgs84.lat, wgs84.lon];
    } catch (e) {
        console.error(`Error converting grid reference "${gridrefStr}":`, e); // Log conversion error
        return null;
    }
}

export function updateLatLon(id) {
    const osGridRef = document.getElementById(id).value;
    const coords = osGridToLatLon(osGridRef);
    document.getElementById(`${id}-coords`).textContent = coords ? `Lat: ${coords[0].toFixed(5)}, Lon: ${coords[1].toFixed(5)}` : '';
}

export function parseInputAndCalculate() {
    const data = {
        start: { osGridRef: document.getElementById("start").value, latLon: osGridToLatLon(document.getElementById("start").value) },
        lunch: { osGridRef: document.getElementById("lunch").value, latLon: osGridToLatLon(document.getElementById("lunch").value) },
        end: { osGridRef: document.getElementById("end").value, latLon: osGridToLatLon(document.getElementById("end").value) },
        waypoints: []
    };

    for (let i = 1; i <= waypointCount; i++) {
        const waypointInput = document.getElementById(`waypoint-${i}`);
        const waypointCoords = osGridToLatLon(waypointInput.value);
        if (waypointCoords) {
            data.waypoints.push({
                osGridRef: waypointInput.value,
                latLon: waypointCoords,
                label: `Waypoint ${i}`
            });
        }
    }

    findOptimumRoutes(data);
}

// Add these lines to expose functions globally
window.updateLatLon = updateLatLon;
window.addWaypoint = addWaypoint;
window.parseInputAndCalculate = parseInputAndCalculate;

let bestRoutesByLunchPosition = {};  // Store best routes per lunch position for map rendering

// Haversine function for distance calculation
export function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = phi2 - phi1;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Compute distance matrix
export function computeDistanceMatrix(locations) {
    const size = locations.length;
    const distanceMatrix = Array.from({ length: size }, () => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
            const dist = haversine(locations[i][0], locations[i][1], locations[j][0], locations[j][1]);
            distanceMatrix[i][j] = dist;
            distanceMatrix[j][i] = dist;
        }
    }
    return distanceMatrix;
}

// Generate all permutations
export function permutations(array) {
    if (array.length === 1) return [array];
    const result = [];
    for (let i = 0; i < array.length; i++) {
        const current = array[i];
        const remaining = array.slice(0, i).concat(array.slice(i + 1));
        const remainingPerms = permutations(remaining);
        for (let perm of remainingPerms) {
            result.push([current, ...perm]);
        }
    }
    return result;
}

export function findOptimumRoutes(data) {
    const start = data.start.latLon;
    const lunch = data.lunch.latLon;
    const end = data.end.latLon;
    const waypoints = data.waypoints;

    if (!start || !lunch || !end) {
        console.error("Invalid start, lunch, or end coordinates");
        return;
    }

    const waypointCoords = waypoints.map(wp => wp.latLon).filter(Boolean);
    const locationNames = ["Start", ...waypoints.map(wp => wp.label), "Lunch", "End"];
    const locations = [start, ...waypointCoords, lunch, end];
    const distanceMatrix = computeDistanceMatrix(locations);

    const numWaypoints = waypointCoords.length;
    const lunchPositions = [3, 4, 5];  // Allowed lunch positions
    const outputContainer = document.getElementById("output");
    outputContainer.innerHTML = "";  // Clear previous output

    lunchPositions.forEach(lunchPosition => {
        let minTotalCost = Infinity;
        let bestRoute;

        const waypointIndices = Array.from({ length: numWaypoints }, (_, i) => i + 1);  // Waypoint indices
        const allPermutations = permutations(waypointIndices);

        for (let perm of allPermutations) {
            const route = [0, ...perm, numWaypoints + 2];  // Start and End
            const routeWithLunch = [
                ...route.slice(0, lunchPosition - 1), 
                numWaypoints + 1, 
                ...route.slice(lunchPosition - 1)
            ]; // Insert lunch at the specified position

            let totalCost = 0;
            for (let i = 0; i < routeWithLunch.length - 1; i++) {
                totalCost += distanceMatrix[routeWithLunch[i]][routeWithLunch[i + 1]];
            }

            if (totalCost < minTotalCost) {
                minTotalCost = totalCost;
                bestRoute = routeWithLunch;
            }
        }

        if (bestRoute) {
            // Store the best route for this lunch position for map rendering
            bestRoutesByLunchPosition[lunchPosition] = bestRoute.map(i => ({ ...locations[i], label: locationNames[i] }));

            // Display route text and add buttons for drawing map and generating GPX
            const routeText = bestRoute.map(i => locationNames[i]).join(" -> ");
            const distanceText = `Total distance: ${(minTotalCost / 1000).toFixed(2)} km`;
            
            const resultDiv = document.createElement("div");
            resultDiv.innerHTML = `<strong>Best route with Lunch at position ${lunchPosition}:</strong><br>${routeText}<br>${distanceText}<br>`;
            
            const drawMapButton = document.createElement("button");
            drawMapButton.textContent = `Draw Map for Lunch at ${lunchPosition}`;
            drawMapButton.onclick = () => drawMap(bestRoutesByLunchPosition[lunchPosition]);
            resultDiv.appendChild(drawMapButton);
            
            const gpxButton = document.createElement("button");
            gpxButton.textContent = `Generate GPX for Lunch at ${lunchPosition}`;
            gpxButton.onclick = () => generateGPX(bestRoutesByLunchPosition[lunchPosition], `Optimal_Route_Lunch_Position_${lunchPosition}.gpx`);
            resultDiv.appendChild(gpxButton);
            
            outputContainer.appendChild(resultDiv);
            outputContainer.appendChild(document.createElement("hr"));
        }
    });
}

export function generateGPX(route, fileName) {
    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="OptimalRouteGenerator" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${fileName}</name><trkseg>\n`;
    
    route.forEach(({ lat, lon }) => {
        if (lat !== undefined && lon !== undefined) {
            gpxContent += `<trkpt lat="${lat}" lon="${lon}"><ele>0</ele><time>${new Date().toISOString()}</time></trkpt>\n`;
        }
    });
    
    gpxContent += "</trkseg></trk></gpx>";

    // Create a blob and download the GPX file
    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
}

export function drawMap(route) {
    if (map) {
        map.remove();  // Clear existing map
    }
    map = L.map('map').setView([route[0][0], route[0][1]], 13);  // Center on start position

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const colors = { Start: 'green', Lunch: 'orange', End: 'red' };
    route.forEach((point, index) => {
        if (point[0] !== undefined && point[1] !== undefined) {
            const markerColor = colors[point.label] || 'blue';
            const marker = L.circleMarker([point[0], point[1]], {
                color: markerColor,
                radius: 5,
                fillOpacity: 1
            }).addTo(map);
            marker.bindPopup(`<strong>${point.label || "Waypoint"}</strong><br>OS Grid Ref: ${point.osGridRef || "N/A"}`);
        }
    });
