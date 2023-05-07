const urlParams = new URLSearchParams(window.location.search);
var center = new kakao.maps.LatLng(33.450701, 126.570667);
var latitude, longitude, distance, dataToSend;
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
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      },
      (error) => {
        console.error("Error getting user location:", error);
        dataToSend = JSON.stringify({
          err: error,
        });
        window.ReactNativeWebView.postMessage(dataToSend);
      }
    );
    distance = parseFloat(urlParams.get("distance"));
  }

  if (distance) {
    fetchData();
  } else {
    center = new kakao.maps.LatLng(latitude, longitude);
    addMarker(center);
    map.setCenter(center);
  }
} catch (e) {
  console.log(e);
  dataToSend = JSON.stringify({
    err: e,
  });
  window.ReactNativeWebView.postMessage(dataToSend);
}

// helper functions
function addMarker(position) {
  const marker = new kakao.maps.Marker({
    position: position,
  });
  marker.setMap(map);
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

  //   const allRoadSets = [];

  //   for (let i = 0; i < 20; i++) {
  //     const randomIndices = new Set();

  //     while (randomIndices.size < Math.min(2, roads.length)) {
  //       const randomIndex = Math.floor(Math.random() * roads.length);
  //       randomIndices.add(randomIndex);
  //     }

  //     const randomRoads = Array.from(randomIndices).map((index) => roads[index]);
  //     const roadCoords = randomRoads.map((road) => {
  //       const coordinates = road.geometry.coordinates;
  //       const middleCoordinate = coordinates[Math.floor(coordinates.length / 2)];

  //       return {
  //         latitude: middleCoordinate[1],
  //         longitude: middleCoordinate[0],
  //       };
  //     });

  //     const origin = {
  //       latitude: latitude,
  //       longitude: longitude,
  //     };

  //     const minDistance = distance * 0.1;

  //     if (
  //       euclideanDistanceInKm(origin, roadCoords[1]) >= minDistance &&
  //       euclideanDistanceInKm(roadCoords[0], roadCoords[1]) >= minDistance &&
  //       euclideanDistanceInKm(roadCoords[1], origin) >= minDistance
  //     ) {
  //       const euclideanDistance = totalEuclideanDistanceInKm(origin, roadCoords);

  //       allRoadSets.push({
  //         roadCoords,
  //         euclideanDistance: euclideanDistance,
  //       });
  //     } else {
  //       // If the roads don't meet the criteria, decrement i to retry with another pair
  //       i--;
  //     }
  //   }

  //   allRoadSets.sort(
  //     (a, b) =>
  //       Math.abs(distance * 0.7 - a.euclideanDistance) -
  //       Math.abs(distance * 0.7 - b.euclideanDistance)
  //   );

  //   const bestFiveRoadSets = allRoadSets.slice(0, 5);

  dataToSend = JSON.stringify({
    distance: distance,
    // bestFiveRoadSets: bestFiveRoadSets,
  });

  center = new kakao.maps.LatLng(
    (latitude + roadCoords[0].latitude + roadCoords[1].latitude) / 3,
    (longitude + roadCoords[0].longitude + roadCoords[1].longitude) / 3
  );
  addMarker(new kakao.maps.LatLng(origin.latitude, origin.longitude));
  map.setCenter(center);

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
