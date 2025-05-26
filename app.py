from flask import Flask, request, jsonify, render_template, Response
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
import requests
from datetime import datetime
import csv, io

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///measurements.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app)

class Measurement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.String(64), nullable=False)
    temperature = db.Column(db.Float, nullable=False)
    pressure = db.Column(db.Float, nullable=False)
    humidity = db.Column(db.Float, nullable=False)
    lux = db.Column(db.Float, nullable=True)
    rain_probability = db.Column(db.Float, nullable=True)

with app.app_context():
    db.create_all()

latest_data = {
    'temperature': None,
    'pressure': None,
    'humidity': None,
    'lux': None,
    'rain_probability': 0,
    'timestamp': None
}

@app.route('/')
def index():
    forecast = get_weather_forecast()
    return render_template('index.html', data=latest_data, forecast=forecast)

@app.route('/data', methods=['POST'])
def receive_data():
    data = request.json
    try:
        latest_data['temperature'] = data['temperature']
        latest_data['pressure'] = data['pressure']
        latest_data['humidity'] = data['humidity']
        latest_data['lux'] = data.get('lux', 0)
        latest_data['rain_probability'] = data.get('rain_probability', 0)
        latest_data['timestamp'] = data.get('timestamp', datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        new_measurement = Measurement(
            timestamp=latest_data['timestamp'],
            temperature=latest_data['temperature'],
            pressure=latest_data['pressure'],
            humidity=latest_data['humidity'],
            lux=latest_data['lux'],
            rain_probability=latest_data['rain_probability']
        )
        db.session.add(new_measurement)
        db.session.commit()
        socketio.emit('new_data', latest_data)
        return jsonify({'status': 'ok'})
    except KeyError as e:
        return jsonify({'status': 'error', 'message': f'Missing field: {e}'}), 400

@app.route('/api/data')
def api_data():
    forecast = get_weather_forecast()
    return jsonify({'current': latest_data, 'forecast': forecast})

@app.route('/api/history')
def api_history():
    measurements = Measurement.query.order_by(Measurement.id).all()
    result = []
    for m in measurements:
        result.append({
            'timestamp': m.timestamp,
            'temperature': m.temperature,
            'pressure': m.pressure,
            'humidity': m.humidity,
            'lux': m.lux,
            'rain_probability': m.rain_probability
        })
    return jsonify(result)

@app.route('/download/history')
def download_history():
    si = io.StringIO()
    cw = csv.writer(si)
    cw.writerow(['timestamp', 'temperature', 'pressure', 'humidity', 'lux', 'rain_probability'])
    measurements = Measurement.query.order_by(Measurement.id).all()
    for m in measurements:
        cw.writerow([m.timestamp, m.temperature, m.pressure, m.humidity, m.lux, m.rain_probability])
    output = si.getvalue()
    response = Response(output, mimetype='text/csv')
    response.headers["Content-Disposition"] = "attachment; filename=history.csv"
    return response

def get_weather_forecast():
    LATITUDE = 52.435
    LONGITUDE = 30.975
    OWM_API_KEY = 'a04d348a4a82cd0f44299bc89dcb0088'
    url = f'https://api.openweathermap.org/data/2.5/forecast?lat={LATITUDE}&lon={LONGITUDE}&units=metric&lang=ru&appid={OWM_API_KEY}'
    try:
        res = requests.get(url)
        data = res.json()
        if 'list' not in data:
            print("API error:", data.get('message', 'No list key'))
            return []
        result = []
        days = {}
        for entry in data['list']:
            dt_txt = entry.get('dt_txt')
            if not dt_txt:
                continue
            date = dt_txt.split()[0]
            temp = entry['main']['temp']
            humidity = entry['main']['humidity']
            pressure = entry['main']['pressure']
            rain = entry.get('pop', 0) * 100
            weather = entry['weather'][0]
            icon = f"http://openweathermap.org/img/wn/{weather['icon']}@2x.png"
            description = weather['description']
            if date not in days:
                days[date] = {'temp_sum': 0, 'humidity_sum': 0, 'pressure_sum': 0, 'rain_sum': 0, 'count': 0, 'icon': icon, 'description': description}
            days[date]['temp_sum'] += temp
            days[date]['humidity_sum'] += humidity
            days[date]['pressure_sum'] += pressure
            days[date]['rain_sum'] += rain
            days[date]['count'] += 1
        for date, values in sorted(days.items())[:5]:
            count = values['count']
            result.append({
                'date': date,
                'temperature': round(values['temp_sum'] / count, 1),
                'humidity': round(values['humidity_sum'] / count),
                'pressure': round(values['pressure_sum'] / count),
                'rain_probability': round(values['rain_sum'] / count),
                'icon': values['icon'],
                'description': values['description']
            })
        return result
    except Exception as e:
        print("Forecast error:", e)
        return []

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
