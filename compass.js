// compass.js
import OsGridRef from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';

let currentPosition = null;
let targetPosition = null;
let watchId = null;
let deviceOrientation = 0;

// Convert OS Grid Reference to Lat/Lon
function osGridToLatLon(gridrefStr) {
    console.log(`Converting OS Grid Reference: ${gridrefStr}`);
    try {
        const gridref = OsGridRef.parse(gridrefStr);
        const wgs84 = gridref.toLatLon();
        console.log(`Converted to Lat/Lon:`, [wgs84.lat, wgs84.lon]);
        return [wgs84.lat, wgs84.lon];
    } catch (e) {
        console.error(`Error converting grid reference "${gridrefStr}":`, e);
        return null;
    }
}

// Format grid reference as "AA 111 111" automatically
function formatAndUpdateTarget() {
    const input = document.getElementById('target');
    const cursorPosition = input.selectionStart;
    const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    let formatted = '';
    let letterCount = 0;
    
    // Extract letters (up to 2)
    for (let i = 0; i < value.length && letterCount < 2; i++) {
        if (/[A-Z]/.test(value[i])) {
            formatted += value[i];
            letterCount++;
        }
    }
    
    // Extract digits (up to 6)
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length > 0) {
        formatted += ' ' + digits.substring(0, 3);
        if (digits.length > 3) {
            formatted += ' ' + digits.substring(3, 6);
        }
    }
    
    // Update input value
    const oldLength = input.value.length;
    input.value = formatted.trim();
    
    // Adjust cursor position after formatting
    const newLength = input.value.length;
    const diff = newLength - oldLength;
    const newCursorPosition = Math.max(0, Math.min(cursorPosition + diff, newLength));
    input.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Update target coordinates
    updateTarget();
}

function updateTarget() {
    const osGridRef = document.getElementById('target').value;
    const coords = osGridToLatLon(osGridRef);
    
    if (coords) {
        targetPosition = { lat: coords[0], lon: coords[1] };
        document.getElementById('target-coords').textContent = 
            `Lat: ${coords[0].toFixed(8)}, Lon: ${coords[1].toFixed(8)}`;
        updateCompass();
    } else {
        targetPosition = null;
        document.getElementById('target-coords').textContent = '';
    }
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const bearing = (θ * 180 / Math.PI + 360) % 360;
    
    return bearing;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) ** 2 + 
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

// Format distance for display
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    } else if (distanceKm < 10) {
        return `${distanceKm.toFixed(2)} km`;
    } else {
        return `${distanceKm.toFixed(1)} km`;
    }
}

// Update compass display
function updateCompass() {
    if (!currentPosition || !targetPosition) {
        return;
    }
    
    const bearing = calculateBearing(
        currentPosition.lat, 
        currentPosition.lon, 
        targetPosition.lat, 
        targetPosition.lon
    );
    
    const distance = calculateDistance(
        currentPosition.lat, 
        currentPosition.lon, 
        targetPosition.lat, 
        targetPosition.lon
    );
    
    // Calculate arrow rotation (bearing - device orientation)
    const arrowRotation = bearing - deviceOrientation;
    
    // Update arrow
    const arrow = document.getElementById('arrow');
    arrow.style.transform = `rotate(${arrowRotation}deg)`;
    
    // Update distance display
    document.getElementById('distance').textContent = formatDistance(distance);
    document.getElementById('bearing').textContent = `Bearing: ${Math.round(bearing)}°`;
    
    // Update status
    const status = document.getElementById('status');
    status.className = 'success';
    status.textContent = `Tracking: ${distance < 0.05 ? 'You have arrived!' : 'Follow the arrow'}`;
}

// Handle device orientation
function handleOrientation(event) {
    if (event.alpha !== null) {
        // Adjust for compass heading (alpha is 0 at North)
        deviceOrientation = event.webkitCompassHeading || event.alpha;
        updateCompass();
    }
}

// Handle position updates
function handlePosition(position) {
    currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
    };
    
    const status = document.getElementById('status');
    if (targetPosition) {
        status.className = 'success';
        status.textContent = 'Location acquired';
    } else {
        status.className = 'info';
        status.textContent = 'Enter target location above';
    }
    
    updateCompass();
}

function handlePositionError(error) {
    const status = document.getElementById('status');
    status.className = 'error';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            status.textContent = 'Location permission denied. Please enable location access.';
            break;
        case error.POSITION_UNAVAILABLE:
            status.textContent = 'Location information unavailable.';
            break;
        case error.TIMEOUT:
            status.textContent = 'Location request timed out.';
            break;
        default:
            status.textContent = 'An unknown error occurred.';
            break;
    }
}

// Request device orientation permission (iOS 13+)
function requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    const status = document.getElementById('status');
                    if (targetPosition) {
                        status.className = 'success';
                        status.textContent = 'Compass enabled';
                    }
                } else {
                    const status = document.getElementById('status');
                    status.className = 'error';
                    status.textContent = 'Compass permission denied. Please enable in Settings.';
                }
            })
            .catch(err => {
                console.error('Orientation permission error:', err);
                const status = document.getElementById('status');
                status.className = 'error';
                status.textContent = 'Could not access device compass.';
            });
    } else {
        // Non-iOS devices or older iOS versions
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

// Request location and orientation permissions
function requestLocationPermission() {
    const status = document.getElementById('status');
    const btn = document.getElementById('enable-location-btn');
    
    if (btn) {
        btn.textContent = 'Requesting permissions...';
        btn.disabled = true;
    }
    
    if ('geolocation' in navigator) {
        // Request location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success - start watching position
                currentPosition = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                
                watchId = navigator.geolocation.watchPosition(
                    handlePosition, 
                    handlePositionError,
                    {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    }
                );
                
                status.className = 'success';
                if (btn) {
                    btn.style.display = 'none';
                }
                if (targetPosition) {
                    status.textContent = 'Location enabled - Enter target above';
                } else {
                    status.textContent = 'Location enabled - Enter target location';
                }
                
                updateCompass();
                
                // Now request orientation
                requestOrientationPermission();
            },
            (error) => {
                handlePositionError(error);
                if (btn) {
                    btn.textContent = 'Retry Location Permission';
                    btn.disabled = false;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        status.className = 'error';
        status.textContent = 'Geolocation is not supported by your browser.';
        if (btn) {
            btn.style.display = 'none';
        }
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    // Don't automatically request permissions on iOS
    // User needs to click the button to trigger permission request
    const status = document.getElementById('status');
    status.className = 'info';
    
    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) {
        // On non-iOS, we can try to auto-request
        requestLocationPermission();
    }
});

// Expose functions globally
window.formatAndUpdateTarget = formatAndUpdateTarget;
window.requestLocationPermission = requestLocationPermission;
