class WeatherAPI {
  constructor() {
    this.baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
  }

  async fetchWeatherData(latitude, longitude, date) {
    try {
      const targetDate = new Date(date);
      const dateString = targetDate.toISOString().split('T')[0];

      const url = new URL(this.baseUrl);
      url.searchParams.append('latitude', latitude);
      url.searchParams.append('longitude', longitude);
      url.searchParams.append('start_date', dateString);
      url.searchParams.append('end_date', dateString);
      url.searchParams.append('daily', 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant');
      url.searchParams.append('hourly', 'temperature_2m,relativehumidity_2m,pressure_msl,visibility,uv_index');
      url.searchParams.append('timezone', 'auto');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return this.processWeatherData(data, dateString);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      return null;
    }
  }

  processWeatherData(data, dateString) {
    if (!data.daily || !data.hourly) {
      return null;
    }

    const daily = data.daily;
    const hourly = data.hourly;
    const index = 0;

    const avgTemp = this.calculateAverage(hourly.temperature_2m);
    const avgHumidity = this.calculateAverage(hourly.relativehumidity_2m);
    const avgPressure = this.calculateAverage(hourly.pressure_msl);
    const avgVisibility = this.calculateAverage(hourly.visibility);
    const maxUV = Math.max(...hourly.uv_index);

    return {
      date: dateString,
      temperature: {
        high: daily.temperature_2m_max[index],
        low: daily.temperature_2m_min[index],
        average: avgTemp
      },
      condition: this.getWeatherCondition(daily.weathercode[index]),
      weatherCode: daily.weathercode[index],
      precipitation: daily.precipitation_sum[index] || 0,
      wind: {
        speed: daily.windspeed_10m_max[index],
        direction: daily.winddirection_10m_dominant[index]
      },
      humidity: avgHumidity,
      pressure: avgPressure,
      visibility: avgVisibility,
      uvIndex: maxUV
    };
  }

  calculateAverage(values) {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((acc, val) => acc + (val || 0), 0);
    return Math.round((sum / values.length) * 10) / 10;
  }

  getWeatherCondition(code) {
    const conditions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };

    return conditions[code] || 'Unknown';
  }

  formatWeatherForDisplay(weatherData) {
    if (!weatherData) {
      return '<p><em>Weather data not available</em></p>';
    }

    return `
      <div class="weather-info">
        <p><strong>Condition:</strong> ${weatherData.condition}</p>
        <p><strong>Temperature:</strong> ${weatherData.temperature.high}°C / ${weatherData.temperature.low}°C</p>
        <p><strong>Wind:</strong> ${weatherData.wind.speed} km/h</p>
        ${weatherData.precipitation > 0 ? `<p><strong>Precipitation:</strong> ${weatherData.precipitation} mm</p>` : ''}
        <p><strong>Humidity:</strong> ${weatherData.humidity}%</p>
      </div>
    `;
  }
}

export default WeatherAPI;
