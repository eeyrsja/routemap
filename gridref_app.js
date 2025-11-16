// Get DOM Elements
const addWaypointBtn = document.getElementById('addWaypoint');
const calculateRouteBtn = document.getElementById('calculateRoute');
const waypointList = document.getElementById('waypointList');
const resultDisplay = document.getElementById('resultDisplay');

let waypoints = [];
let startPoint = null;
let endPoint = null;
let waypointCounter = 0; // Counter for waypoint labels

// Add waypoint functionality
addWaypointBtn.addEventListener('click', () => {
    const waypointInput = document.createElement('input');
    waypointInput.type = 'text';
    waypointInput.placeholder = `Enter waypoint OS Grid Ref (e.g. SP 234 405)`;
    waypointInput.id = `waypoint-${waypointCounter}`;
    waypointInput.dataset.id = waypointCounter;

    const waypointLabelInput = document.createElement('input');
    waypointLabelInput.type = 'text';
    waypointLabelInput.placeholder = `Waypoint label (default: WP${waypointCounter + 1})`;
    waypointLabelInput.id = `waypoint-label-${waypointCounter}`;

    waypointList.appendChild(waypointInput);
    waypointList.appendChild(waypointLabelInput);
    waypointList.appendChild(document.createElement('br'));

    waypointCounter++;
});

// Calculate route
calculateRouteBtn.addEventListener('click', () => {
    const waypointsData = [];
    for (let i = 0; i < waypointCounter; i++) {
        const gridRef = document.getElementById(`waypoint-${i}`).value;
        const label = document.getElementById(`waypoint-label-${i}`).value || `WP${i + 1}`;

        if (gridRef) {
            const latLon = osGridToLatLon(gridRef);
            if (latLon) {
                waypointsData.push({ id: i, gridRef, latLon, label });
            }
        }
    }

    if (waypointsData.length < 2) {
        alert('Please add at least two valid waypoints.');
        return;
    }

    // Extract points from waypointsData to use in the distance matrix
    const allPoints = waypointsData;
    const distanceMatrix = buildDistanceMatrix(allPoints);

    // Use Held-Karp to find the optimal path
    const startIdx = 0;
    const endIdx = allPoints.length - 1;
    const { path, cost } = heldKarp(distanceMatrix, startIdx, endIdx);

    if (cost === Infinity) {
        alert('No valid path found.');
        return;
    }

    // Display results
    displayResults(path, allPoints);
});

// Helper to convert OS Grid Ref to lat/lon (dummy function for illustration)
function osGridToLatLon(gridRef) {
    // This is where you would use a library or implement the actual OS Grid to Lat/Lon conversion.
    // For now, this is a stub function returning some dummy coordinates for demonstration purposes.
    const matches = gridRef.match(/([A-Z]{2})\s*(\d{3})\s*(\d{3})/);
    if (!matches) return null;
    
    const easting = parseFloat(matches[2]);
    const northing = parseFloat(matches[3]);
    // Conversion logic goes here, returning a dummy lat/lon for demonstration.
    const lat = 52.0 + (easting / 10000); // Dummy transformation
    const lon = -1.0 + (northing / 10000); // Dummy transformation
    return { lat: lat.toFixed(8), lon: lon.toFixed(8) };
}

// Build a distance matrix between all points
function buildDistanceMatrix(points) {
    const size = points.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
            const dist = haversineDistance(points[i].latLon, points[j].latLon);
            matrix[i][j] = dist;
            matrix[j][i] = dist; // Since it's undirected
        }
    }
    return matrix;
}

// Calculate Haversine distance between two lat/lon coordinates
function haversineDistance(coord1, coord2) {
    const R = 6371; // Radius of Earth in km
    const lat1 = toRadians(coord1.lat);
    const lon1 = toRadians(coord1.lon);
    const lat2 = toRadians(coord2.lat);
    const lon2 = toRadians(coord2.lon);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Convert degrees to radians
function toRadians(deg) {
    return deg * (Math.PI / 180);
}

// Held-Karp algorithm for Hamiltonian Path with fixed start and end points
function heldKarp(distanceMatrix, start, end) {
    const n = distanceMatrix.length;
    const size = 1 << n;
    const dp = Array.from({ length: size }, () => Array(n).fill(Infinity));
    const parent = Array.from({ length: size }, () => Array(n).fill(null));

    dp[1 << start][start] = 0;

    for (let subset = 0; subset < size; subset++) {
        if (!(subset & (1 << start))) continue; // Subsets must include the start node

        for (let last = 0; last < n; last++) {
            if (!(subset & (1 << last))) continue; // Last node must be in the subset

            for (let next = 0; next < n; next++) {
                if (subset & (1 << next)) continue; // Next node must not be in the subset

                const nextSubset = subset | (1 << next);
                const newCost = dp[subset][last] + distanceMatrix[last][next];

                if (dp[nextSubset][next] > newCost) {
                    dp[nextSubset][next] = newCost;
                    parent[nextSubset][next] = last;
                }
            }
        }
    }

    const fullSet = (1 << n) - 1;
    const minCost = dp[fullSet][end];
    const path = [];
    let currentNode = end;
    let currentSubset = fullSet;

    while (currentNode !== null) {
        path.push(currentNode);
        const temp = parent[currentSubset][currentNode];
        currentSubset = currentSubset & ~(1 << currentNode);
        currentNode = temp;
    }

    path.reverse();
    return { path, cost: minCost };
}

// Display the results
function displayResults(path, points) {
    resultDisplay.innerHTML = '';
    path.forEach((pointIdx, i) => {
        const point = points[pointIdx];
        const pointInfo = document.createElement('div');
        pointInfo.innerHTML = `${i + 1}. ${point.label} (OS Grid: ${point.gridRef}) - Lat/Lon: (${point.latLon.lat}, ${point.latLon.lon})`;
        resultDisplay.appendChild(pointInfo);
    });
}
