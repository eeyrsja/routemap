import OsGridRef from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';

// Update Lat/Lon Display for an Input Field
function updateLatLon(input) {
    const coords = convertGridRefToLatLon(input.value);
    console.log(`Updating Lat/Lon for ${input.id}:`, coords); // Log coordinates

    const display = document.getElementById(input.dataset.output);
    if (display) {
        display.textContent = coords ? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` : "Invalid Grid Ref";
    } else {
        console.warn(`No display element found for ${input.dataset.output}`); // Warn if the element is missing
    }
}

// Convert OS Grid Reference to Lat/Lon
function convertGridRefToLatLon(gridrefStr) {
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

// Add a New Waypoint Row Dynamically
function addWaypoint() {
    const waypointContainer = document.getElementById("waypoints");
    const waypointCount = waypointContainer.childElementCount;
    const label = String.fromCharCode(65 + waypointCount); // A, B, C, etc.

    console.log(`Adding Waypoint ${label}`);

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

// Export Form Data to JSON with Lat/Lon included
function exportToJSON() {
    try {
        // Helper function to get both OS grid ref and lat/lon for a given element ID
        function getGridRefWithLatLon(id) {
            const gridRef = document.getElementById(id)?.value;
            if (gridRef) {
                const coords = convertGridRefToLatLon(gridRef);
                return {
                    osGridRef: gridRef,
                    latLon: coords ? { lat: coords[0], lon: coords[1] } : "Invalid Grid Ref"
                };
            }
            return null;
        }

        // Collect data for start, lunch, and end points
        const data = {
            start: getGridRefWithLatLon("start"),
            lunch: getGridRefWithLatLon("lunch"),
            end: getGridRefWithLatLon("end"),
            waypoints: []
        };

        console.log("Collecting waypoints for JSON export"); // Log start of waypoint collection

        // Collect all dynamically added waypoints
        const waypointContainer = document.getElementById("waypoints");
        waypointContainer.querySelectorAll(".waypoint-row input[type='text']").forEach((waypointInput, index) => {
            const waypointLabel = String.fromCharCode(65 + index); // A, B, C, etc.
            if (waypointInput.value) {
                const coords = convertGridRefToLatLon(waypointInput.value);
                data.waypoints.push({
                    label: `Waypoint ${waypointLabel}`,
                    osGridRef: waypointInput.value,
                    latLon: coords ? { lat: coords[0], lon: coords[1] } : "Invalid Grid Ref"
                });
                console.log(`Collected waypoint ${waypointLabel}:`, waypointInput.value); // Log each collected waypoint
            } else {
                console.warn(`Waypoint ${waypointLabel} input missing or empty`);
            }
        });

        console.log("Exported JSON Data:", JSON.stringify(data, null, 2)); // Log final JSON data
        document.getElementById("jsonOutput").textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error("Error in exportToJSON:", error); // Log any error during export
    }
}

// Event Listeners for Button Actions and Input Fields
document.addEventListener("DOMContentLoaded", () => {
    // Set up event listeners for initial input fields (start, lunch, end, and waypointA)
    const initialFields = ["start", "lunch", "end", "waypointA"];
    initialFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener("input", function() {
                updateLatLon(this);
            });
        } else {
            console.warn(`Initial field ${fieldId} not found`);
        }
    });

    document.getElementById("add-waypoint-btn").addEventListener("click", addWaypoint);
    document.getElementById("export-json-btn").addEventListener("click", exportToJSON);
    document.getElementById("find-route-btn").addEventListener("click", findOptimalRoute);
});


// Find the Optimal Route Using Held-Karp Algorithm with Lunch Constraint
function findOptimalRoute() {
    try {
        const locations = {
            start: document.getElementById("start").value,
            lunch: document.getElementById("lunch").value,
            end: document.getElementById("end").value,
            waypoints: Array.from(document.querySelectorAll(".waypoint-row input[type='text']")).map(input => input.value)
        };
        console.log("Locations for route optimization:", locations); // Log all locations

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
                    console.log(`Distance from ${from} to ${to}:`, distances[from][to]); // Log calculated distance
                }
            });
        });

        // ... Held-Karp algorithm logic remains unchanged ...
    } catch (error) {
        console.error("Error in findOptimalRoute:", error); // Log any error during route finding
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
