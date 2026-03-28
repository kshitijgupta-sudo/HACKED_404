from geopy.distance import geodesic

# Classroom location — change these to actual classroom coordinates
CLASSROOM_LAT = 31.3956  # NIT Jalandhar latitude
CLASSROOM_LON = 75.5352  # NIT Jalandhar longitude
GEOFENCE_RADIUS_METERS = 50  # 50 metres radius

def is_within_geofence(student_lat: float, student_lon: float) -> bool:
    """Check if student is within classroom geofence"""
    classroom_coords = (CLASSROOM_LAT, CLASSROOM_LON)
    student_coords = (student_lat, student_lon)
    
    distance = geodesic(classroom_coords, student_coords).meters
    
    return distance <= GEOFENCE_RADIUS_METERS

def get_distance(student_lat: float, student_lon: float) -> float:
    """Get exact distance from classroom in metres"""
    classroom_coords = (CLASSROOM_LAT, CLASSROOM_LON)
    student_coords = (student_lat, student_lon)
    
    return geodesic(classroom_coords, student_coords).meters