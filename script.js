const cityInput = document.getElementById('cityInput');
const searchForm = document.getElementById('searchForm');
const statusMessage = document.getElementById('statusMessage');
const cityName = document.getElementById('cityName');
const weatherCondition = document.getElementById('weatherCondition');
const temperature = document.getElementById('temperature');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('windSpeed');
const weatherIcon = document.getElementById('weatherIcon');
const locationButton = document.getElementById('locationButton');
const saveFavoriteButton = document.getElementById('saveFavoriteButton');
const favoritesList = document.getElementById('favoritesList');
const forecastList = document.getElementById('forecastList');

const favoritesStorageKey = 'weather-app-favorites';
const weatherDescriptions = {
  clear: { icon: '☀️', label: 'Clear sky', background: 'clear' },
  cloudy: { icon: '☁️', label: 'Cloudy', background: 'cloudy' },
  rain: { icon: '🌧️', label: 'Rainy', background: 'rain' },
  snow: { icon: '❄️', label: 'Snowy', background: 'snow' },
  storm: { icon: '⛈️', label: 'Stormy', background: 'storm' },
  fog: { icon: '🌫️', label: 'Foggy', background: 'fog' },
};

let currentCityName = '';
let favorites = JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]');

function updateStatus(message) {
  statusMessage.textContent = message;
}

function buildDisplayName(place) {
  const parts = [];
  if (place.name && place.name !== place.country) {
    parts.push(place.name);
  }
  if (place.admin1 && place.admin1 !== place.name && place.admin1 !== place.country) {
    parts.push(place.admin1);
  }
  if (place.country && place.country !== place.name && place.country !== place.admin1) {
    parts.push(place.country);
  }
  return parts.join(', ') || place.name || 'Location';
}

function renderFavorites() {
  if (!favorites.length) {
    favoritesList.innerHTML = '<li class="favorite-item">No favorite cities yet</li>';
    return;
  }

  favoritesList.innerHTML = favorites
    .map(
      (city) => `
        <li>
          <button class="favorite-item" type="button" data-city="${city}">${city}</button>
        </li>
      `
    )
    .join('');
}

function saveFavorites() {
  localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
  renderFavorites();
}

function addFavorite(city) {
  const normalizedCity = city.trim();
  if (!normalizedCity || normalizedCity === 'Your current location' || normalizedCity === 'Unavailable') {
    updateStatus('There is no valid city to save yet.');
    return;
  }

  if (!favorites.includes(normalizedCity)) {
    favorites = [normalizedCity, ...favorites].slice(0, 6);
    saveFavorites();
    updateStatus(`${normalizedCity} added to favorites.`);
  } else {
    updateStatus(`${normalizedCity} is already in favorites.`);
  }
}

function renderForecast(days) {
  if (!days || !days.length) {
    forecastList.innerHTML = '<p class="status-message">Forecast unavailable.</p>';
    return;
  }

  forecastList.innerHTML = days
    .map((day) => {
      const label = new Date(day.date).toLocaleDateString('en', { weekday: 'short' });
      return `
        <article class="forecast-item">
          <div class="forecast-day">${label}</div>
          <div class="forecast-temp">${Math.round(day.max)}° / ${Math.round(day.min)}°</div>
        </article>
      `;
    })
    .join('');
}

function updateWeatherUI(weatherData, placeName) {
  const { code, temperature: temp, humidity: humidityValue, windSpeed: windValue } = weatherData;
  const weatherStyle = getWeatherStyle(code);
  currentCityName = placeName;
  cityName.textContent = placeName;
  weatherCondition.textContent = weatherStyle.label;
  temperature.textContent = `${temp}°C`;
  humidity.textContent = `${humidityValue}%`;
  windSpeed.textContent = `${windValue} km/h`;
  weatherIcon.textContent = weatherStyle.icon;
  document.body.className = weatherStyle.background;
}

function getWeatherStyle(code) {
  if (code === 0) return weatherDescriptions.clear;
  if ([1, 2, 3].includes(code)) return weatherDescriptions.cloudy;
  if ([45, 48].includes(code)) return weatherDescriptions.fog;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return weatherDescriptions.rain;
  if ([71, 73, 75, 77].includes(code)) return weatherDescriptions.snow;
  if ([95, 96, 99].includes(code)) return weatherDescriptions.storm;
  return weatherDescriptions.cloudy;
}

async function fetchWeatherByCity(city) {
  try {
    const normalizedCity = city.trim();
    updateStatus(`Searching for ${normalizedCity}...`);
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalizedCity)}&count=5&language=en&format=json`
    );

    if (!geoRes.ok) {
      throw new Error('Unable to reach the geocoding service.');
    }

    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`No results found for “${normalizedCity}”.`);
    }

    const normalizedQuery = normalizedCity.toLowerCase();
    const place =
      geoData.results.find((candidate) => {
        const candidateName = candidate.name?.toLowerCase() || '';
        const candidateAdmin = candidate.admin1?.toLowerCase() || '';
        const candidateCountry = candidate.country?.toLowerCase() || '';
        return (
          candidateName === normalizedQuery ||
          candidateAdmin === normalizedQuery ||
          candidateCountry === normalizedQuery ||
          candidateName.includes(normalizedQuery)
        );
      }) || geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    );

    if (!weatherRes.ok) {
      throw new Error('Unable to fetch weather data.');
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    const daily = weatherData.daily;
    const displayName = buildDisplayName(place);
    updateWeatherUI(
      {
        code: current.weather_code,
        temperature: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
      },
      displayName
    );
    renderForecast(
      daily.time.slice(0, 7).map((date, index) => ({
        date,
        max: daily.temperature_2m_max[index],
        min: daily.temperature_2m_min[index],
      }))
    );
    currentCityName = displayName;
    updateStatus(`Showing weather for ${place.name}.`);
  } catch (error) {
    updateStatus(error.message || 'Something went wrong.');
    cityName.textContent = 'Unavailable';
    weatherCondition.textContent = 'Try another city';
    temperature.textContent = '--';
    humidity.textContent = '--';
    windSpeed.textContent = '--';
    weatherIcon.textContent = '❓';
    forecastList.innerHTML = '';
    document.body.className = '';
  }
}

async function fetchWeatherByCoordinates(latitude, longitude) {
  try {
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    );

    if (!weatherRes.ok) {
      throw new Error('Unable to fetch weather data for your location.');
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current;
    const daily = weatherData.daily;
    updateWeatherUI(
      {
        code: current.weather_code,
        temperature: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
      },
      'Your current location'
    );
    renderForecast(
      daily.time.slice(0, 7).map((date, index) => ({
        date,
        max: daily.temperature_2m_max[index],
        min: daily.temperature_2m_min[index],
      }))
    );
    currentCityName = '';
    updateStatus('Weather loaded from your current location.');
  } catch (error) {
    updateStatus(error.message || 'Location weather could not be loaded.');
  }
}

favoritesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-city]');
  if (!button) return;
  const city = button.dataset.city;
  if (city) {
    fetchWeatherByCity(city);
    cityInput.value = city;
  }
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    updateStatus('Please enter a city name.');
    return;
  }
  fetchWeatherByCity(city);
});

locationButton.addEventListener('click', () => {
  if (!navigator.geolocation) {
    updateStatus('Geolocation is not supported by this browser.');
    return;
  }

  updateStatus('Finding your location...');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetchWeatherByCoordinates(position.coords.latitude, position.coords.longitude);
    },
    () => {
      updateStatus('Location permission was denied. Try searching for a city instead.');
    }
  );
});

saveFavoriteButton.addEventListener('click', () => {
  addFavorite(currentCityName);
});

renderFavorites();
fetchWeatherByCity('London');
