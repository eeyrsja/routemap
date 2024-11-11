import OsGridRef from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';

// Update Lat/Lon Display for an Input Field
function updateLatLon(input) {
    const coords = convertGridRefToLatLon(input.value);
    const display = document.getElementById(input.dataset.output);
    display.textContent = coords ? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` : "Invalid Grid Ref";
}

// Convert OS Grid Reference to Lat/Lon
function convertGridRefToLatLon(gridrefStr) {
    try {
        const gridref = OsGridRef.parse(gridrefStr);
        const wgs84 = gridref.toLatLon();
        return [wgs84.lat, wgs84.lon];
    } catch (e) {
        return null;
    }
}

// Add a New Waypoint Row Dynamically
function addWaypoint() {
    const waypointContainer = document.getElementById("waypoints");
    const waypointCount = waypointContainer.childElementCount;
    const label = String.fromCharCode(65 + waypointCount); // A, B, C, etc.

    const row = document.createElement("div");
    row.classList.add("waypoint-row");
    row.innerHTML = `
        <label for="waypoint${label}">Waypoint ${label}:</label>
        <input type="text" id="waypoint${label}" placeholder="e.g., SO 645 154" data-output="latLon${label}">
        <span id="latLon${label}" class="lat-lon-output">Enter a valid OS Grid Ref</span>
    `;
    waypointContainer.appendChild(row);

    // Attach event listener to the new waypoint input to update coordinates
    document.getElementById(`waypoint${label}`).addEventListener("input", function() {
        updateLatLon(this);
    });
}

// Export Form Data to JSON
function exportToJSON() {
    try {
        const data = {
            start: document.getElementById("start").value,
            lunch: document.getElementById("lunch").value,
            end: document.getElementById("end").value,
            waypoints: []
        };

        // Collect waypoints
        const waypointContainer = document.getElementById("waypoints");
        waypointContainer.querySelectorAll(".waypoint-row").forEach(row => {
            const waypointInput = row.querySelector("input[type='text']");
            data.waypoints.push(waypointInput.value);
        });

        document.getElementById("jsonOutput").textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error("Error in exportToJSON:", error);
    }
}

// Find the Optimal Route Using Held-Karp Algorithm with Lunch Constraint
function findOptimalRoute() {
    try {
        const locations = {
            start: document.getElementById("start").value,
            lunch: document.getElementById("lunch").value,
            end: document.getElementById("end").value,
            waypoints: Array.from(document.querySelectorAll(".waypoint-row input[type='text']")).map(input => input.value)
        };

        const coords = {};
        const nodes = ["start", ...locations.waypoints.map((_, i) => String.fromCharCode(65 + i)), "lunch", "end"];

        // Convert locations to lat/lon coordinates
        nodes.forEach(node => {
            const ref = node === "start" ? locations.start : 
                        node === "end" ? locations.end : 
                        node === "lunch" ? locations.lunch : 
                        locations.waypoints[node.charCodeAt(0) - 65];
            coords[node] = convertGridRefToLatLon(ref);
        });

        // Compute Distance Matrix
        const distances = {};
        nodes.forEach((from) => {
            distances[from] = {};
            nodes.forEach((to) => {
                if (from !== to && coords[from] && coords[to]) {
                    distances[from][to] = haversine(...coords[from], ...coords[to]);
                }
            });
        });

        // Held-Karp Algorithm for Optimal Route with Lunch Constraint
        const dp = {};
        const backtrack = {};
        const n = nodes.length;

        dp[(1 << nodes.indexOf("start")) + nodes.indexOf("start")] = 0;

        for (let subsetSize = 2; subsetSize < n; subsetSize++) {
            for (const subset of combinations(nodes.slice(1), subsetSize)) {
                const bits = subset.reduce((a, b) => a | (1 << nodes.indexOf(b)), 1 << nodes.indexOf("start"));
                subset.forEach(endNode => {
                    if (endNode === "lunch" && subsetSize < 3) return; // Lunch constraint
                    const prevBits = bits & ~(1 << nodes.indexOf(endNode));
                    let minCost = Infinity;
                    let bestPrev = null;
                    subset.forEach(prevNode => {
                        if (prevNode !== endNode && distances[prevNode][endNode]) {
                            const cost = (dp[prevBits * n + prevNode] || Infinity) + distances[prevNode][endNode];
                            if (cost < minCost) {
                                minCost = cost;
                                bestPrev = prevNode;
                            }
                        }
                    });
                    dp[bits * n + endNode] = minCost;
                    backtrack[bits * n + endNode] = bestPrev;
                });
            }
        }

        // Extract the Optimal Route
        let last = "end";
        let bits = (1 << n) - 1;
        const route = [];
        while (last) {
            route.push(last);
            last = backtrack[bits * n + nodes.indexOf(last)];
            if (last) bits &= ~(1 << nodes.indexOf(last));
        }
        route.reverse();
        document.getElementById("routeOutput").textContent = `Optimal Route: ${route.join(" -> ")}`;
    } catch (error) {
        console.error("Error in findOptimalRoute:", error);
    }
}

// Haversine Formula for Distance Calculation
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Generate Combinations of Nodes
function combinations(arr, k) {
    const result = [];
    function backtrack(start, combo) {
        if (combo.length === k) result.push(combo.slice());
        for (let i = start; i < arr.length; i++) backtrack(i + 1, combo.concat(arr[i]));
    }
    backtrack(0, []);
    return result;
}

// Event Listeners for Button Actions and Input Fields
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("add-waypoint-btn").addEventListener("click", addWaypoint);
    document.getElementById("export-json-btn").addEventListener("click", exportToJSON);
    document.getElementById("find-route-btn").addEventListener("click", findOptimalRoute);

    // Attach event listeners to initial input fields for lat/lon display
    document.querySelectorAll("input[type='text']").forEach(input => {
        input.addEventListener("input", function() {
            updateLatLon(this);
        });
    });
});
