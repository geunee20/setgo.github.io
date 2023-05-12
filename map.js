const urlParams = new URLSearchParams(window.location.search);
var origin_map = new kakao.maps.LatLng(35.306065, 128.59633);
var latitude, longitude, distance, dataToSend;
const mapContainer = document.getElementById("map");
const mapOptions = {
  center: origin_map,
  level: 3,
  draggable: true,
};

const map = new kakao.maps.Map(mapContainer, mapOptions);

(async () => {
  try {
    if (window.ReactNativeWebView) {
      latitude = urlParams.get("lat");
      longitude = urlParams.get("lon");
      distance = parseFloat(urlParams.get("distance")) * 1000;
    } else {
      const position = await getCurrentPosition();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      distance = parseFloat(urlParams.get("distance")) * 1000;
    }
    origin_map = new kakao.maps.LatLng(latitude, longitude);
    const marker = new kakao.maps.Marker({
      map: map,
      position: origin_map,
    });

    if (distance) {
      const bestFiveRoadSets = await getBestFiveRoadSets();
      const bestRoute = await getBestRoute(bestFiveRoadSets);
      drawRouteOnKakaoMap(map, bestRoute);
      if (window.ReactNativeWebView) {
        dataToSend = JSON.stringify({
          bestRoute: bestRoute,
        });
        window.ReactNativeWebView.postMessage(dataToSend);
      }
    } else {
      map.setCenter(origin_map);
    }
  } catch (error) {
    console.log(`Error: ${error}`);
    if (window.ReactNativeWebView) {
      dataToSend = JSON.stringify({
        error: e,
      });
      window.ReactNativeWebView.postMessage(dataToSend);
    }
  }
})();

// helper functions
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

async function getBestFiveRoadSets() {
  const overpassQuery = `[out:json][timeout:5];(way[highway~"^(residential|footway|cycleway)$"](around:${
    distance / 4
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

    origin = {
      latitude: latitude,
      longitude: longitude,
    };

    const minDistance = distance * 0.1;

    if (
      distanceInKm(origin, roadCoords[1]) >= minDistance &&
      distanceInKm(roadCoords[0], roadCoords[1]) >= minDistance &&
      distanceInKm(roadCoords[1], origin) >= minDistance
    ) {
      const euclideanDistance = totalDistanceInKm(origin, roadCoords);

      allRoadSets.push({
        roadCoords,
        euclideanDistance: euclideanDistance,
      });
    } else {
      i--;
    }
  }

  allRoadSets.sort(
    (a, b) =>
      Math.abs(distance * 0.7 - a.euclideanDistance) -
      Math.abs(distance * 0.7 - b.euclideanDistance)
  );

  return allRoadSets.slice(0, 5);
}

function distanceInKm(point1, point2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const R = 6371;
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) *
      Math.cos(toRadians(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function totalDistanceInKm(origin, markers) {
  const marker1 = markers[0];
  const marker2 = markers[1];

  return (
    distanceInKm(origin, marker1) +
    distanceInKm(marker1, marker2) +
    distanceInKm(marker2, origin)
  );
}

async function getBestRoute(bestFiveRoadSets) {
  const bestFiveRoutes = await fetchAllRoutes(origin, bestFiveRoadSets, origin);
  const bestRoute = findBestRoute(bestFiveRoutes, distance);
  console.log(bestRoute.features[0].properties.totalDistance);
  return bestRoute;
}

async function fetchAllRoutes(origin, waypointsSets, destination) {
  const fetchRoutePromises = waypointsSets.map(
    async (waypointSet) =>
      await getPedestrianRoute(origin, waypointSet.roadCoords, destination)
  );

  const allRoutesData = await Promise.all(fetchRoutePromises);
  return allRoutesData;
}

async function getPedestrianRoute(origin, waypoints, destination) {
  const response = await fetch(
    "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&callback=function",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        appKey: "sFsOVpTBQW2OAsZVdXkpw2mhVDKFIMKD6IrNByYk",
      },
      body: JSON.stringify({
        startName: "%EC%B6%9C%EB%B0%9C",
        startX: origin.longitude,
        startY: origin.latitude,
        endName: "%EB%8F%84%EC%B0%A9%0A",
        endX: destination.longitude,
        endY: destination.latitude,
        passList: waypoints
          .map((point, index) => `${point.longitude},${point.latitude}`)
          .join("_"),
        speed: 8,
      }),
    }
  );

  const routeData = await response.json();
  console.log(routeData.features[0].properties.totalDistance);
  return routeData;
}

function findBestRoute(routes, desiredDistance) {
  let closestRoute = null;
  let smallestDifference = Infinity;

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const totalDistance = route.features[0].properties.totalDistance;
    const difference = Math.abs(totalDistance - desiredDistance);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestRoute = route;
    }
  }
  return closestRoute;
}

function drawRouteOnKakaoMap(map, route) {
  const coordinates = route.features
    .filter((feature) => feature.geometry.type === "LineString")
    .map((feature) => feature.geometry.coordinates)
    .flat();

  const path = coordinates.map(
    (coord) => new kakao.maps.LatLng(coord[1], coord[0])
  );

  const polyline = new kakao.maps.Polyline({
    map: map,
    path: path,
    strokeWeight: 4,
    strokeColor: "#ff0000",
    strokeOpacity: 0.7,
  });

  const bounds = new kakao.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  map.setBounds(bounds);
}
