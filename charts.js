document.addEventListener("DOMContentLoaded", function() {
  const googleScriptURL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLipar2uB9HzCf7T1jaEIOs46-I0ZdlGbMYSYAGJdS0B_lTSjXZdcJ6Xi37rJTAuyjUMxYXCogxyQawl8gI4wFJnpBfp3VD6rfa_0_4i2Vm2KEX8qESdOZf2we0TsuvGCm_s0_N9xg0ckuAXxZNrCDv8cJjN1BTi4j0CjIM4hrs8mtiPjC_D7g4WWai9ukwoTzVMjutoVWzvL4s4fauJx74CXr71wr5fciW7fd4xwlaDHBoCT-0pJd7BQXBzHG9V1Ut85Qfu8qvQWHvI0m8xQwl4H2lhfbQt7WiJLzl8&lib=MhFWv9sayUGjmtRDpvnxqcNqHkzK3DmFw";

  const temperatureCtx = document.getElementById('temperatureChart').getContext('2d');
  const humidityCtx = document.getElementById('humidityChart').getContext('2d');
  const pressureCtx = document.getElementById('pressureChart').getContext('2d');

  const temperatureChart = new Chart(temperatureCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Температура (°C)',
        data: [],
        borderColor: 'red',
        fill: false
      }]
    }
  });

  const humidityChart = new Chart(humidityCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Влажность (%)',
        data: [],
        borderColor: 'blue',
        fill: false
      }]
    }
  });

  const pressureChart = new Chart(pressureCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Давление (hPa)',
        data: [],
        borderColor: 'green',
        fill: false
      }]
    }
  });

  const historyCtx = document.getElementById('historyChart').getContext('2d');
  const historyChart = new Chart(historyCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Температура (°C) (История)',
        data: [],
        borderColor: 'purple',
        fill: false
      }]
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: {
            parser: 'YYYY-MM-DD HH:mm:ss',
            tooltipFormat: 'll HH:mm'
          },
          title: {
            display: true,
            text: 'Время'
          }
        }
      }
    }
  });

  // Функция для получения данных с Google Apps Script
  async function fetchMeasurements() {
    try {
      const response = await fetch(googleScriptURL);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        console.warn("Нет данных");
        return null;
      }
      return data;
    } catch (error) {
      console.error("Ошибка при получении данных:", error);
      return null;
    }
  }

  async function updateDynamicData() {
    const data = await fetchMeasurements();
    if (!data) return;

    // Предположим, что структура объекта: 
    // { Timestamp: "2025-05-26 15:27:34", Temperature: XX, Pressure: XX, Humidity: XX, Lux: XX, RainProbability: XX, Icon: "...", Description: "..." }
    const current = data[data.length - 1];
    // Обновляем текущие показатели
    document.getElementById('temperature').textContent = current.Temperature + ' °C';
    document.getElementById('pressure').textContent = current.Pressure + ' hPa';
    document.getElementById('humidity').textContent = current.Humidity + ' %';
    document.getElementById('lux').textContent = current.Lux + ' лк';
    document.getElementById('rain_probability').textContent = current.RainProbability + ' %';
    document.getElementById('timestamp').textContent = current.Timestamp;

    // Используем последние 5 измерений для «прогноза»
    const forecast = data.slice(-5).reverse();
    const forecastContainer = document.getElementById('forecast-container');
    forecastContainer.innerHTML = "";
    let newLabels = [];
    let newTempData = [];
    let newHumData = [];
    let newPresData = [];

    forecast.forEach(day => {
      newLabels.push(day.Timestamp);
      newTempData.push(day.Temperature);
      newHumData.push(day.Humidity);
      newPresData.push(day.Pressure);

      const dayDiv = document.createElement('div');
      dayDiv.className = 'forecast-card';
      dayDiv.innerHTML = `
        <img src="${day.Icon || ''}" alt="Иконка погоды">
        <div class="forecast-info">
          <h3>${day.Timestamp.split(' ')[0]}</h3>
          <p>Температура: <span>${day.Temperature}</span> °C</p>
          <p>Влажность: <span>${day.Humidity}</span> %</p>
          <p>Давление: <span>${day.Pressure}</span> hPa</p>
          <p>Дождь: <span>${day.RainProbability}</span> %</p>
          <p>${day.Description || ''}</p>
        </div>
      `;
      forecastContainer.appendChild(dayDiv);
    });

    // Обновляем глобальную переменную для графиков
    window.forecastData.labels = newLabels;
    window.forecastData.temperature = newTempData;
    window.forecastData.humidity = newHumData;
    window.forecastData.pressure = newPresData;

    temperatureChart.data.labels = newLabels;
    temperatureChart.data.datasets[0].data = newTempData;
    humidityChart.data.labels = newLabels;
    humidityChart.data.datasets[0].data = newHumData;
    pressureChart.data.labels = newLabels;
    pressureChart.data.datasets[0].data = newPresData;

    temperatureChart.update();
    humidityChart.update();
    pressureChart.update();
  }

  async function updateHistoryChart() {
    const data = await fetchMeasurements();
    if (!data) return;
    const timeLabels = data.map(record => record.Timestamp);
    const tempData = data.map(record => record.Temperature);
    historyChart.data.labels = timeLabels;
    historyChart.data.datasets[0].data = tempData;
    historyChart.update();
  }

  // Обновляем данные сразу и затем каждые 30 секунд
  updateDynamicData();
  updateHistoryChart();
  setInterval(updateDynamicData, 30000);
  setInterval(updateHistoryChart, 30000);

  // Если вы не используете socket.io на статичном сайте, можно отключить следующий блок:
  /*
  const socket = io();
  socket.on('new_data', function(data) {
    document.getElementById('temperature').textContent = data.temperature + ' °C';
    document.getElementById('pressure').textContent = data.pressure + ' hPa';
    document.getElementById('humidity').textContent = data.humidity + ' %';
    document.getElementById('lux').textContent = data.lux + ' лк';
    document.getElementById('rain_probability').textContent = data.rain_probability + ' %';
    document.getElementById('timestamp').textContent = data.timestamp;
    updateHistoryChart();
  });
  */
});
