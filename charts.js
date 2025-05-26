document.addEventListener("DOMContentLoaded", function() {
    // Инициализация графиков прогнозов
    const temperatureCtx = document.getElementById('temperatureChart').getContext('2d');
    const humidityCtx = document.getElementById('humidityChart').getContext('2d');
    const pressureCtx = document.getElementById('pressureChart').getContext('2d');

    const temperatureChart = new Chart(temperatureCtx, {
        type: 'line',
        data: {
            labels: window.forecastData.labels,
            datasets: [{
                label: 'Температура (°C)',
                data: window.forecastData.temperature,
                borderColor: 'red',
                fill: false
            }]
        }
    });

    const humidityChart = new Chart(humidityCtx, {
        type: 'line',
        data: {
            labels: window.forecastData.labels,
            datasets: [{
                label: 'Влажность (%)',
                data: window.forecastData.humidity,
                borderColor: 'blue',
                fill: false
            }]
        }
    });

    const pressureChart = new Chart(pressureCtx, {
        type: 'line',
        data: {
            labels: window.forecastData.labels,
            datasets: [{
                label: 'Давление (hPa)',
                data: window.forecastData.pressure,
                borderColor: 'green',
                fill: false
            }]
        }
    });

    // Инициализация графика истории измерений с использованием временной шкалы
    const historyCtx = document.getElementById('historyChart').getContext('2d');
    const historyChart = new Chart(historyCtx, {
        type: 'line',
        data: {
            labels: [],  // Временные метки
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

    // Функция для обновления динамических данных (текущие показатели, прогноз)
    async function updateDynamicData() {
        console.log("Updating dynamic data...");
        try {
            const response = await fetch('/api/data');
            const result = await response.json();
            const current = result.current;
            const forecast = result.forecast;
            document.getElementById('temperature').textContent = current.temperature + ' °C';
            document.getElementById('pressure').textContent = current.pressure + ' hPa';
            document.getElementById('humidity').textContent = current.humidity + ' %';
            document.getElementById('lux').textContent = current.lux + ' лк';
            document.getElementById('rain_probability').textContent = current.rain_probability + ' %';
            document.getElementById('timestamp').textContent = current.timestamp;
            
            const forecastContainer = document.getElementById('forecast-container');
            forecastContainer.innerHTML = "";
            const newLabels = [];
            const newTempData = [];
            const newHumData = [];
            const newPresData = [];
            
            forecast.forEach(day => {
                newLabels.push(day.date);
                newTempData.push(day.temperature);
                newHumData.push(day.humidity);
                newPresData.push(day.pressure);
                
                const dayDiv = document.createElement('div');
                dayDiv.className = 'forecast-card';
                dayDiv.innerHTML = `
                    <img src="${day.icon}" alt="Иконка погоды">
                    <div class="forecast-info">
                        <h3>${day.date}</h3>
                        <p>Температура: <span>${day.temperature}</span> °C</p>
                        <p>Влажность: <span>${day.humidity}</span> %</p>
                        <p>Давление: <span>${day.pressure}</span> hPa</p>
                        <p>Дождь: <span>${day.rain_probability}</span> %</p>
                        <p>${day.description}</p>
                    </div>
                `;
                forecastContainer.appendChild(dayDiv);
            });
            
            // Обновляем данные графиков прогнозов
            temperatureChart.data.labels = newLabels;
            temperatureChart.data.datasets[0].data = newTempData;
            humidityChart.data.labels = newLabels;
            humidityChart.data.datasets[0].data = newHumData;
            pressureChart.data.labels = newLabels;
            pressureChart.data.datasets[0].data = newPresData;
            temperatureChart.update();
            humidityChart.update();
            pressureChart.update();
        } catch (error) {
            console.error('Error updating dynamic data:', error);
            const notification = document.getElementById('notification');
            notification.classList.remove('hidden');
            setTimeout(() => {
                notification.classList.add('hidden');
            }, 5000);
        }
    }

    // Функция для обновления графика истории измерений
    async function updateHistoryChart() {
        console.log("Updating history chart...");
        try {
            const response = await fetch('/api/history');
            const history = await response.json();
            console.log("Received history:", history);
            if (!Array.isArray(history) || history.length === 0) {
                console.warn("History is empty");
                return;
            }
            const timeLabels = history.map(record => record.timestamp);
            const tempData = history.map(record => record.temperature);
            historyChart.data.labels = timeLabels;
            historyChart.data.datasets[0].data = tempData;
            historyChart.update();
        } catch (error) {
            console.error('Error updating history chart:', error);
        }
    }

    // Отдельные интервалы для обновления данных
    setInterval(updateDynamicData, 30000);
    setInterval(updateHistoryChart, 30000);

    // Подключаем Socket.IO для мгновенной передачи новых данных
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
});
