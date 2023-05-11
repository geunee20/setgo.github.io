const urlParams = new URLSearchParams(window.location.search);
var origin = new kakao.maps.LatLng(33.450701, 126.570667);
var latitude, longitude, distance, dataToSend;
const mapContainer = document.getElementById("map");
const mapOptions = {
  center: origin,
  level: 3,
  draggable: true,
};

const map = new kakao.maps.Map(mapContainer, mapOptions);

(async () => {
  try {
    if (window.ReactNativeWebView) {
      latitude = urlParams.get("lat");
      longitude = urlParams.get("lon");
      distance = parseFloat(urlParams.get("distance"));
    } else {
      const position = await getCurrentPosition();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      distance = parseFloat(urlParams.get("distance"));
    }
    origin = new kakao.maps.LatLng(latitude, longitude);
    const marker = new kakao.maps.Marker({
      map: map,
      position: origin,
    });

    if (distance) {
      await fetchData();
    } else {
      map.setCenter(origin);
    }
  } catch (e) {
    console.log(e);
    if (window.ReactNativeWebView) {
      dataToSend = JSON.stringify({
        err: e,
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

    origin = {
      latitude: latitude,
      longitude: longitude,
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
      i--;
    }
  }

  allRoadSets.sort(
    (a, b) =>
      Math.abs(distance * 0.7 - a.euclideanDistance) -
      Math.abs(distance * 0.7 - b.euclideanDistance)
  );

  const bestFiveRoadSets = allRoadSets.slice(0, 5);
  const bestFiveRoutes = await fetchAllRoutes(
    origin,
    [bestFiveRoadSets[0]], //need to change this later
    origin
  );
  const bestRoute = findClosestRoute(bestFiveRoutes, distance);
  drawRouteOnKakaoMap(map, bestRoute);

  // if (window.ReactNativeWebView) {
  //   fetchDirections(
  //     { latitude: latitude, longitude: longitude },
  //     bestFiveRoadSets
  //   );
  // } else {
  //   Geolocation.getCurrentPosition(
  //     (position) => fetchDirections(position, bestFiveRoadSets),
  //     (error) => console.log(error),
  //     { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
  //   );
  // }

  // const bestRoute = bestFiveRoutes;

  // center = new kakao.maps.LatLng(
  //   (latitude +
  //     bestFiveRoadSets.roadCoords[0].latitude +
  //     bestFiveRoadSets.roadCoords[1].latitude) /
  //     3,
  //   (longitude +
  //     bestFiveRoadSets.roadCoords[0].longitude +
  //     bestFiveRoadSets.roadCoords[1].longitude) /
  //     3
  // );

  if (window.ReactNativeWebView) {
    dataToSend = JSON.stringify({
      distance: distance,
      bestFiveRoadSets: bestFiveRoadSets,
      err: roads,
    });
    window.ReactNativeWebView.postMessage(dataToSend);
  }
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

async function fetchAllRoutes(origin, waypointsSets, destination) {
  const fetchRoutePromises = waypointsSets.map(
    async (waypointSet) =>
      await getPedestrianRoute(origin, waypointSet.roadCoords, destination)
  );

  try {
    const allRoutesData = await Promise.all(fetchRoutePromises);
    return allRoutesData;
  } catch (error) {
    console.error("Error fetching pedestrian routes:", error);
  }
}

async function getPedestrianRoute(origin, waypoints, destination) {
  try {
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
  } catch (error) {
    console.error("Error fetching pedestrian route:", error);
  }
}

function findClosestRoute(routes, desiredDistance) {
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

  let cumulativeDistance = 0;
  let prevPoint = null;
  let markerCounter = 1;

  path.forEach((point) => {
    if (prevPoint) {
      const distance = calculateDistance(
        prevPoint.getLat(),
        prevPoint.getLng(),
        point.getLat(),
        point.getLng()
      );
      cumulativeDistance += distance;

      if (cumulativeDistance >= 1) {
        new kakao.maps.Marker({
          position: point,
          map: map,
        });

        var label =
          '<div class="label"><span>' + markerCounter + "</span></div>";

        var overlay = new kakao.maps.CustomOverlay({
          position: point,
          content: label,
          map: map,
        });

        markerCounter++;
        cumulativeDistance = 0;
      }
    }
    prevPoint = point;
  });
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
