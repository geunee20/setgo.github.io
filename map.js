const urlParams = new URLSearchParams(window.location.search);
var center = new kakao.maps.LatLng(33.450701, 126.570667);
var latitude, longitude;
var distance;
const mapContainer = document.getElementById("map");
const mapOptions = {
  center: center,
  level: 3,
};

const map = new kakao.maps.Map(mapContainer, mapOptions);

try {
  if (window.ReactNativeWebView) {
    latitude = urlParams.get("lat");
    longitude = urlParams.get("lon");
    distance = parseFloat(urlParams.get("distance"));

    fetchData();
  } else {
    showUserLocation();
  }
} catch (e) {
  console.log(e);
}

function addMarker(position) {
  const marker = new kakao.maps.Marker({
    position: position,
  });
  marker.setMap(map);
}

function showUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        center = new kakao.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        map.setCenter(center);
        addMarker(center);
      },
      (error) => {
        console.error("Error getting user location:", error);
      }
    );
  } else {
    console.error("Geolocation is not supported by this browser.");
  }
}

async function fetchData() {
  const overpassQuery = `[out:json][timeout:5];(way[highway~"^(residential|footway|cycleway)$"](around:${
    (distance * 1000) / 4
  },${latitude},${longitude});>;);out;`;

  const response = await axios.get("https://overpass-api.de/api/interpreter", {
    params: { data: overpassQuery },
  });
  const geojson = osmtogeojson(response.data);
  const roads = geojson.features.filter(
    (feature) => feature.geometry.type === "LineString"
  );

  const allRoadSets = [];

  for (let i = 0; i < 20; i++) {
    const randomIndices = new Set();

    while (randomIndices.size < Math.min(2, roads.length)) {
      const randomIndex = Math.floor(Math.random() * roads.length);
      randomIndices.add(randomIndex);
    }

    const randomRoads = Array.from(randomIndices).map((index) => roads[index]);
    const roadCoords = randomRoads.map((road) => {
      const coordinates = road.geometry.coordinates;
      const middleCoordinate = coordinates[Math.floor(coordinates.length / 2)];

      return {
        latitude: middleCoordinate[1],
        longitude: middleCoordinate[0],
      };
    });

    const origin = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    const minDistance = distance * 0.1;

    if (
      euclideanDistanceInKm(origin, roadCoords[1]) >= minDistance &&
      euclideanDistanceInKm(roadCoords[0], roadCoords[1]) >= minDistance &&
      euclideanDistanceInKm(roadCoords[1], origin) >= minDistance
    ) {
      const euclideanDistance = totalEuclideanDistanceInKm(origin, roadCoords);

      allRoadSets.push({
        roadCoords,
        euclideanDistance: euclideanDistance,
      });
    } else {
      // If the roads don't meet the criteria, decrement i to retry with another pair
      i--;
    }
  }

  allRoadSets.sort(
    (a, b) =>
      Math.abs(distance * 0.7 - a.euclideanDistance) -
      Math.abs(distance * 0.7 - b.euclideanDistance)
  );

  const bestFiveRoadSets = allRoadSets.slice(0, 5);
  center = new kakao.maps.LatLng(latitude, longitude);
  addMarker(center);
  map.setCenter(center);

  const dataToSend = JSON.stringify({
    distance: distance,
    bestFiveRoadSets: bestFiveRoadSets,
  });
  window.ReactNativeWebView.postMessage(dataToSend);
}

function euclideanDistanceInKm(point1, point2) {
  const x1 = point1.latitude;
  const y1 = point1.longitude;
  const x2 = point2.latitude;
  const y2 = point2.longitude;

  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) * 111.32;
}

function totalEuclideanDistanceInKm(origin, markers) {
  const marker1 = markers[0];
  const marker2 = markers[1];

  return (
    euclideanDistanceInKm(origin, marker1) +
    euclideanDistanceInKm(marker1, marker2) +
    euclideanDistanceInKm(marker2, origin)
  );
}
