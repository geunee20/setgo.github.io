const urlParams = new URLSearchParams(window.location.search);
var center = new kakao.maps.LatLng(33.450701, 126.570667);
const mapContainer = document.getElementById("map");
const mapOptions = {
  center: center,
  level: 3,
};

const map = new kakao.maps.Map(mapContainer, mapOptions);

if (window.ReactNativeWebView) {
  center = new kakao.maps.LatLng(
    parseFloat(urlParams.get("lat")),
    parseFloat(urlParams.get("lng"))
  );
  addMarker(center);
  map.setCenter(center);
} else {
  showUserLocation();
}

if (!window.ReactNativeWebView) {
}

function addMarker(position) {
  const marker = new kakao.maps.Marker({
    position,
  });
  marker.setMap(map);
}

function showUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLatLng = new kakao.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        map.setCenter(userLatLng);
        addMarker(userLatLng);
      },
      (error) => {
        console.error("Error getting user location:", error);
      }
    );
  } else {
    console.error("Geolocation is not supported by this browser.");
  }
}
