// Get DOM Elements
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const imageUpload = document.getElementById('imageUpload');
const addWaypointBtn = document.getElementById('addWaypoint');
const startRouteBtn = document.getElementById('startRoute');
const endRouteBtn = document.getElementById('endRoute');
const calculateRouteBtn = document.getElementById('calculateRoute');
const resetBtn = document.getElementById('reset');
const saveBtn = document.getElementById('save');
const loadBtn = document.getElementById('load');

let image = new Image();
let waypoints = [];
let startPoint = null;
let endPoint = null;
let isAddingWaypoint = false;
let isAddingStart = false;
let isAddingEnd = false;
let pointId = 0;
let waypointCounter = 0; // Counter for waypoint labels

// Adjust canvas size
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    redrawAll();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Handle image upload
imageUpload.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const url = URL.createObjectURL(file);
    image.src = url;
    image.onload = () => {
        redrawAll();
    };
});

// Event listeners for adding points
function handleCanvasClick(event) {
    event.preventDefault();
    let x, y;

    const rect = canvas.getBoundingClientRect();
    if (event.type.startsWith('touch')) {
        x = ((event.touches[0].clientX - rect.left) / rect.width) * canvas.width;
        y = ((event.touches[0].clientY - rect.top) / rect.height) * canvas.height;
    } else {
        x = ((event.clientX - rect.left) / rect.width) * canvas.width;
        y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    }

    if (isAddingWaypoint) {
        waypointCounter++;
        const waypoint = { id: pointId++, x, y, label: waypointCounter.toString() };
        waypoints.push(waypoint);
        drawPoint(waypoint, 'blue');
        isAddingWaypoint = false;
    } else if (isAddingStart) {
        startPoint = { id: 'start', x, y, label: 'Start' };
        drawPoint(startPoint, 'green');
        isAddingStart = false;
    } else if (isAddingEnd) {
        endPoint = { id: 'end', x, y, label: 'End' };
        drawPoint(endPoint, 'red');
        isAddingEnd = false;
    }
}

canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchstart', handleCanvasClick);

addWaypointBtn.addEventListener('click', () => {
    isAddingWaypoint = true;
});

startRouteBtn.addEventListener('click', () => {
    isAddingStart = true;
});

endRouteBtn.addEventListener('click', () => {
    isAddingEnd = true;
});

resetBtn.addEventListener('click', () => {
    waypoints = [];
    startPoint = null;
    endPoint = null;
    pointId = 0;
    waypointCounter = 0;
    redrawAll();
});

saveBtn.addEventListener('click', () => {
    const data = {
        waypoints,
        startPoint,
        endPoint,
        imageSrc: image.src
    };
    localStorage.setItem('routeData', JSON.stringify(data));
    alert('Route saved!');
});

loadBtn.addEventListener('click', () => {
    const data = JSON.parse(localStorage.getItem('routeData'));
    if (data) {
        waypoints = data.waypoints;
        startPoint = data.startPoint;
        endPoint = data.endPoint;
        image.src = data.imageSrc;
        image.onload = () => {
            redrawAll();
        };
    } else {
        alert('No saved route found.');
    }
});

// Update the calculateRouteBtn event listener
calculateRouteBtn.addEventListener('click', () => {
    if (!startPoint || !endPoint || waypoints.length === 0) {
        alert('Please add a start point, end point, and at least one waypoint.');
        return;
    }

    // Combine all points
    const allPoints = [startPoint, ...waypoints, endPoint];

    // Build the distance matrix
    const distanceMatrix = buildDistanceMatrix(allPoints);

    const startIdx = 0; // startPoint is at index 0
    const endIdx = allPoints.length - 1; // endPoint is at the last index

    // Find the shortest path using the corrected Held-Karp algorithm
    const { path, cost } = heldKarp(distanceMatrix, startIdx, endIdx);

    // Check if a valid path exists
    if (cost === Infinity) {
        alert('No valid path found.');
        return;
    }

    // Map the path indices back to point IDs
    const pointOrder = path.map(index => allPoints[index].id);

    // Redraw everything
    redrawAll();

    // Draw the route
    drawRoute(pointOrder);
});

// Build a distance matrix between all points
function buildDistanceMatrix(points) {
    const size = points.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
            const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
            matrix[i][j] = dist;
            matrix[j][i] = dist; // Since it's undirected
        }
    }
    return matrix;
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

            // Skip if start and last are the same but subset has more than one node
            if (last === start && subset !== (1 << start)) continue;

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

    // The minimal cost to reach the end node, having visited all nodes
    const minCost = dp[fullSet][end];

    // Reconstruct the path
    const path = [];
    let currentNode = end;
    let currentSubset = fullSet;

    while (currentNode !== null) {
        path.push(currentNode);
        const temp = parent[currentSubset][currentNode];
        currentSubset = currentSubset & ~(1 << currentNode);
        currentNode = temp;
    }

    path.reverse(); // Reverse the path to get the correct order

    return { path, cost: minCost };
}

// Draw the route on the canvas
function drawRoute(pointOrder) {
    if (!ctx) {
        console.error("Canvas context not found");
        return;
    }

    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let distances = [];

    // Draw route and calculate distances
    for (let i = 0; i < pointOrder.length; i++) {
        const point = getPointById(pointOrder[i]);
        if (!point) {
            console.error(`Point with ID ${pointOrder[i]} not found`);
            continue;
        }

        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);

            // Calculate distance between this point and the previous point
            const prevPoint = getPointById(pointOrder[i - 1]);
            if (!prevPoint) {
                console.error(`Previous point with ID ${pointOrder[i - 1]} not found`);
                continue;
            }

            const dist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
            distances.push(dist);
        }
    }
    ctx.stroke();

    // If there are distances to scale
    if (distances.length > 0) {
        // Calculate the average distance
        const totalDistance = distances.reduce((acc, dist) => acc + dist, 0);
        const avgDistance = totalDistance / distances.length;

        // Scale distances so that the average leg length is 100
        const scaledDistances = distances.map(dist => {
            return (dist / avgDistance) * 100;
        });

        // Display the scaled distances along the route
        for (let i = 1; i < pointOrder.length; i++) {
            const startPt = getPointById(pointOrder[i - 1]);
            const endPt = getPointById(pointOrder[i]);

            if (!startPt || !endPt) {
                console.error(`Could not find points with IDs ${pointOrder[i - 1]} or ${pointOrder[i]}`);
                continue;
            }

            // Calculate midpoint for displaying the distance
            const midX = (startPt.x + endPt.x) / 2;
            const midY = (startPt.y + endPt.y) / 2;

            // Display the scaled distance as an integer
            const scaledDist = Math.round(scaledDistances[i - 1]);

            // Debugging: Log the distance being displayed
            console.log(`Displaying scaled distance: ${scaledDist} at midpoint (${midX}, ${midY})`);

            // Add a background rectangle for better readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(midX - 10, midY - 15, 30, 20);

            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(scaledDist.toString(), midX - 5, midY);
        }
    } else {
        console.warn("No distances found to display");
    }
}



// Helper function to get point by id
function getPointById(id) {
    if (id === 'start') return startPoint;
    if (id === 'end') return endPoint;
    return waypoints.find(wp => wp.id === id);
}

// Redraw everything
function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image.src) {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    if (startPoint) drawPoint(startPoint, 'green');
    waypoints.forEach(wp => drawPoint(wp, 'blue'));
    if (endPoint) drawPoint(endPoint, 'red');
}

// Waypoint Editing and Removal
canvas.addEventListener('dblclick', (event) => {
    event.preventDefault();
    let x, y;

    const rect = canvas.getBoundingClientRect();
    x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    const selectedPoint = waypoints.find(wp => {
        return Math.hypot(wp.x - x, wp.y - y) < 10;
    });

    if (selectedPoint) {
        const action = confirm('Do you want to remove this waypoint?');
        if (action) {
            waypoints = waypoints.filter(wp => wp.id !== selectedPoint.id);
            redrawAll();
        }
    }
});
