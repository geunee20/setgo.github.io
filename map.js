const defaultCenter = new kakao.maps.LatLng(33.450701, 126.570667);
const mapContainer = document.getElementById("map");
const mapOptions = {
  center: defaultCenter,
  level: 3,
};

const map = new kakao.maps.Map(mapContainer, mapOptions);

if (!window.ReactNativeWebView) {
  showUserLocation();
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
