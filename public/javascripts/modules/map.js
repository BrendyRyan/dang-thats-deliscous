import axios from "axios";
import { $ } from "./bling";

const mapOptions = {
  center: { lat: 43.2, lng: -79.8 },
  zoom: 8
};

// make this dynamic based on your locaiton using "navigator.geolocation.getCurrentPosition". this can be found on the JavaScript in 30 Days course by Wes Bos.
function loadPlaces(map, lat = 43.2, lng = -79.8) {
  axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`).then(res => {
    const places = res.data;
    if (!places.length) {
      alert("No places found.");
      return;
    }

    // create a map bounds (boundary for zooming)
    const bounds = new google.maps.LatLngBounds();

    // info window for pointer information
    const infoWindow = new google.maps.InfoWindow();

    const markers = places.map(place => {
      const [placeLng, placeLat] = place.location.coordinates;
      const position = { lat: placeLat, lng: placeLng };
      bounds.extend(position);
      const marker = new google.maps.Marker({
        map: map,
        position: position
      });
      marker.place = place;
      return marker;
    });
    // when someone clicks on a market, show the details of that place
    markers.forEach(marker =>
      marker.addListener("click", function() {
        const html = `
        <div class="popup">
            <a href="/store/${this.place.slug}">
                <img src="/uploads/${this.place.photo || "store.png"}" alt="${
          this.place.name
        }" />
                <p>${this.place.name} - ${this.place.location.address}</p>
            </a>
        </div>`;
        infoWindow.setContent(html);
        infoWindow.open(map, this);
      })
    );

    // then zoom the map to fit all the markers perfectly.
    map.setCenter(bounds.getCenter());
    map.fitBounds(bounds);
  });
}

function makeMap(mapDiv) {
  if (!mapDiv) return;
  // make our map
  const map = new google.maps.Map(mapDiv, mapOptions);
  loadPlaces(map);

  const input = $('[name="geolocate"]');
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    loadPlaces(
      map,
      place.geometry.location.lat(),
      place.geometry.location.lng()
    );
  });
}

export default makeMap;
