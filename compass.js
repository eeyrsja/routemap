// compass.js
import OsGridRef from 'https://cdn.jsdelivr.net/npm/geodesy@2/osgridref.js';

let currentPosition = null;
let targetPosition = null;
let watchId = null;
let deviceOrientation = 0;
let lastPosition = null;
let useGPSHeading = false;
let manualCalibration = 0;

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
    
    // Calculate arrow rotation relative to device orientation
    // When device points at target, arrow should point up (0 degrees)
    // bearing = direction to target from north
    // deviceOrientation = direction device is pointing from north
    // arrowRotation = bearing - deviceOrientation
    const arrowRotation = bearing - deviceOrientation;
    
    // Update arrow
    const arrow = document.getElementById('arrow');
    arrow.style.transform = `rotate(${arrowRotation}deg)`;
    
    // Update distance display
    document.getElementById('distance').textContent = formatDistance(distance);
    document.getElementById('bearing').textContent = `Target: ${Math.round(bearing)}° | Phone: ${Math.round(deviceOrientation)}°`;
    
    // Update status
    const status = document.getElementById('status');
    status.className = 'success';
    status.textContent = distance < 0.05 ? 'You have arrived!' : 'Point phone at target';
}

// Handle device orientation
function handleOrientation(event) {
    let newOrientation = null;
    
    // Try 1: webkitCompassHeading (legacy iOS Safari)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        newOrientation = event.webkitCompassHeading;
    }
    // Try 2: Absolute orientation with alpha
    else if (event.absolute && event.alpha !== null) {
        newOrientation = 360 - event.alpha;
    }
    // Try 3: Relative alpha (less reliable, but better than nothing)
    else if (event.alpha !== null) {
        newOrientation = (360 - event.alpha + manualCalibration) % 360;
    }
    
    if (newOrientation !== null && !useGPSHeading) {
        deviceOrientation = newOrientation;
        updateCompass();
    }
}

// Calculate heading from GPS movement (course over ground)
function calculateGPSHeading(oldPos, newPos) {
    if (!oldPos || !newPos) return null;
    
    const lat1 = oldPos.lat * Math.PI / 180;
    const lat2 = newPos.lat * Math.PI / 180;
    const lon1 = oldPos.lon * Math.PI / 180;
    const lon2 = newPos.lon * Math.PI / 180;
    
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const heading = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    
    return heading;
}

// Handle position updates
function handlePosition(position) {
    currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        heading: position.coords.heading
    };
    
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

// Request compass/orientation permission (must be called from user gesture)
async function requestCompassPermission() {
    const status = document.getElementById('status');
    const compassBtn = document.getElementById('enable-compass-btn');
    
    if (compassBtn) {
        compassBtn.textContent = 'Requesting...';
        compassBtn.disabled = true;
    }
    
    try {
        let compassGranted = false;
        
        // Request DeviceMotionEvent permission
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            const motionPerm = await DeviceMotionEvent.requestPermission();
            if (motionPerm !== 'granted') {
                throw new Error('Motion permission denied');
            }
        }
        
        // Request DeviceOrientationEvent permission
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            const orientPerm = await DeviceOrientationEvent.requestPermission();
            
            if (orientPerm === 'granted') {
                compassGranted = true;
                window.addEventListener('deviceorientation', handleOrientation, true);
                window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            } else {
                throw new Error('Orientation permission denied');
            }
        } else {
            // Non-iOS or older iOS - just add listeners
            window.addEventListener('deviceorientation', handleOrientation, true);
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            compassGranted = true;
        }
        
        if (compassGranted) {
            status.className = 'success';
            status.textContent = 'Compass enabled';
            if (compassBtn) {
                compassBtn.textContent = '✓ Compass Enabled';
                compassBtn.disabled = true;
            }
        }
        
    } catch (error) {
        status.className = 'error';
        status.textContent = 'Compass denied. Enable in Settings > Safari > Motion & Orientation.';
        if (compassBtn) {
            compassBtn.textContent = 'Enable Compass';
            compassBtn.disabled = false;
        }
    }
}

// Request location permission separately
async function requestLocationPermission() {
    const status = document.getElementById('status');
    const btn = document.getElementById('enable-location-btn');
    
    if (btn) {
        btn.textContent = 'Requesting...';
        btn.disabled = true;
    }
    
    if (!('geolocation' in navigator)) {
        status.className = 'error';
        status.textContent = 'Geolocation not supported';
        if (btn) btn.style.display = 'none';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentPosition = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                heading: position.coords.heading
            };
            
            watchId = navigator.geolocation.watchPosition(
                handlePosition, 
                handlePositionError,
                {
                    enableHighAccuracy: true,
                    timeout: 2000,
                    maximumAge: 500
                }
            );
            
            status.className = 'success';
            if (btn) {
                btn.textContent = '✓ Location Enabled';
                btn.disabled = true;
            }
            status.textContent = targetPosition 
                ? 'All enabled - Point phone at target'
                : 'All enabled - Enter target location';
            
            updateCompass();
        },
        (error) => {
            status.className = 'error';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    status.textContent = 'Location denied. Enable in Settings > Safari > Location Services.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    status.textContent = 'Location unavailable';
                    break;
                case error.TIMEOUT:
                    status.textContent = 'Location timeout';
                    break;
                default:
                    status.textContent = 'Location error';
                    break;
            }
            
            if (btn) {
                btn.textContent = 'Enable Location';
                btn.disabled = false;
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
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

// Calibrate compass manually
function calibrateCompass() {
    if (!targetPosition || !currentPosition) {
        alert('Please enter a target location and ensure GPS is working first.');
        return;
    }
    
    const targetBearing = calculateBearing(
        currentPosition.lat,
        currentPosition.lon,
        targetPosition.lat,
        targetPosition.lon
    );
    
    // Calculate calibration offset
    // Assume user is currently pointing phone at target
    manualCalibration = (targetBearing - deviceOrientation + 360) % 360;
    
    alert(`Compass calibrated! Point your phone at the target and press OK.\nCalibration offset: ${Math.round(manualCalibration)}°`);
    
    const status = document.getElementById('status');
    status.className = 'success';
    status.textContent = 'Compass calibrated - Manual mode';
}

// Expose functions globally
window.formatAndUpdateTarget = formatAndUpdateTarget;
window.requestCompassPermission = requestCompassPermission;
window.requestLocationPermission = requestLocationPermission;
