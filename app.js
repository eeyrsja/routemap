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

calculateRouteBtn.addEventListener('click', () => {
    if (!startPoint || !endPoint || waypoints.length === 0) {
        alert('Please add a start point, end point, and at least one waypoint.');
        return;
    }

    // Combine all points
    const allPoints = [startPoint, ...waypoints, endPoint];

    // Build the distance matrix
    const distanceMatrix = buildDistanceMatrix(allPoints);

    // Find the shortest path using the Held-Karp algorithm
    const { path, cost } = heldKarp(distanceMatrix);

    // Map the path indices back to point IDs
    const pointOrder = path.map(index => allPoints[index].id);

    // Redraw everything
    redrawAll();

    // Draw the route
    drawRoute(pointOrder);
});

// Draw a point on the canvas
function drawPoint(point, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fill();

    if (point.label) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(point.label, point.x + 7, point.y - 7);
    }
}

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

// Held-Karp algorithm for TSP
function heldKarp(distanceMatrix) {
    const n = distanceMatrix.length;
    const start = 0; // Start point index
    const END_STATE = (1 << n) - 1;

    const memo = {};
    const prev = {};

    function visit(city, state) {
        const key = `${city}|${state}`;
        if (memo[key] !== undefined) {
            return memo[key];
        }

        if (state === (1 << city) | 1) {
            return distanceMatrix[start][city];
        }

        let minCost = Infinity;
        let minPrevCity = null;

        const prevState = state & ~(1 << city);

        for (let prevCity = 0; prevCity < n; prevCity++) {
            if (prevCity === city || !(prevState & (1 << prevCity))) continue;

            const cost = visit(prevCity, prevState) + distanceMatrix[prevCity][city];
            if (cost < minCost) {
                minCost = cost;
                minPrevCity = prevCity;
            }
        }

        memo[key] = minCost;
        prev[key] = minPrevCity;
        return minCost;
    }

    // Start the recursion from the end point
    const minTourCost = visit(n - 1, END_STATE);

    // Backtrack to find full path
    let state = END_STATE;
    let city = n - 1;
    const tour = [];

    while (true) {
        tour.push(city);
        const key = `${city}|${state}`;
        city = prev[key];
        if (city === null) break;
        state = state & ~(1 << tour[tour.length - 1]);
    }

    tour.push(start); // Add the start point
    tour.reverse();

    return { path: tour, cost: minTourCost };
}

// Draw the route on the canvas
function drawRoute(pointOrder) {
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let distances = [];

    for (let i = 0; i < pointOrder.length; i++) {
        const point = getPointById(pointOrder[i]);
        if (i === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);

            // Calculate distance between this point and the previous point
            const prevPoint = getPointById(pointOrder[i - 1]);
            const dist = Math.hypot(point.x - prevPoint.x, point.y - prevPoint.y);
            distances.push(dist);
        }
    }
    ctx.stroke();

    // If there are distances to scale
    if (distances.length > 0) {
        // Scale distances so that the first leg is 100
        const firstDistance = distances[0];
        const scaledDistances = distances.map(dist => {
            return (dist / firstDistance) * 100;
        });

        // Display the scaled distances along the route
        for (let i = 1; i < pointOrder.length; i++) {
            const startPt = getPointById(pointOrder[i - 1]);
            const endPt = getPointById(pointOrder[i]);

            // Calculate midpoint for displaying the distance
            const midX = (startPt.x + endPt.x) / 2;
            const midY = (startPt.y + endPt.y) / 2;

            // Display the scaled distance as an integer
            const scaledDist = Math.round(scaledDistances[i - 1]);

            // Add a background rectangle for better readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(midX - 10, midY - 15, 30, 20);

            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(scaledDist.toString(), midX - 5, midY);
        }
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
