import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
import requests
import re
from datetime import datetime
import base64
from io import BytesIO

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    PDF_LIB_AVAILABLE = True
except ImportError:
    print("Error: reportlab module not found. Please install it using 'pip install reportlab'.")
    PDF_LIB_AVAILABLE = False

# Load environment variables
load_dotenv()

# ==================== GROQ CONFIG ====================
GROQ_API_KEYS = [
    os.getenv(f"GROQ_API_KEY_{i}") for i in range(1, 7)
    if os.getenv(f"GROQ_API_KEY_{i}")
]
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

if not GROQ_API_KEYS or not WEATHER_API_KEY:
    raise ValueError("Missing GROQ_API_KEY_1 (or more) and WEATHER_API_KEY in .env file.")

current_groq_key_index = 0

def get_groq_client():
    global current_groq_key_index
    if current_groq_key_index >= len(GROQ_API_KEYS):
        raise ValueError("All Groq API keys have been exhausted.")
    print(f"Using Groq API key {current_groq_key_index + 1}")
    return Groq(api_key=GROQ_API_KEYS[current_groq_key_index])

# Conversion factors to acres
UNIT_CONVERSIONS = {
    "acre": 1.0,
    "bigha": 0.619,
    "yard": 0.0002066
}

# City to state mapping
CITY_TO_STATE = {
    'mumbai': 'maharashtra', 'delhi': 'delhi', 'bangalore': 'karnataka',
    'hyderabad': 'telangana', 'ahmedabad': 'gujarat', 'chennai': 'tamil nadu',
    'kolkata': 'west bengal', 'pune': 'maharashtra', 'jaipur': 'rajasthan',
    'lucknow': 'uttar pradesh', 'kanpur': 'uttar pradesh', 'nagpur': 'maharashtra',
    'indore': 'madhya pradesh', 'bhopal': 'madhya pradesh', 'patna': 'bihar',
    'vadodara': 'gujarat', 'ludhiana': 'punjab', 'agra': 'uttar pradesh',
    'faridabad': 'haryana', 'varanasi': 'uttar pradesh', 'srinagar': 'jammu and kashmir',
    'amritsar': 'punjab', 'ranchi': 'jharkhand', 'coimbatore': 'tamil nadu',
    'madurai': 'tamil nadu', 'raipur': 'chhattisgarh', 'guwahati': 'assam',
    'chandigarh': 'chandigarh', 'mysore': 'karnataka', 'gurgaon': 'haryana',
    'bhubaneswar': 'odisha', 'thiruvananthapuram': 'kerala', 'kochi': 'kerala',
    'mangalore': 'karnataka', 'noida': 'uttar pradesh', 'new delhi': 'delhi',
    'ajmer': 'rajasthan', 'surat': 'gujarat', 'nashik': 'maharashtra',
    'jodhpur': 'rajasthan', 'kota': 'rajasthan',
}

# Soil data
SOIL_DATA = {
    'andhra pradesh': {'ph': 7.2, 'nitrogen': 320, 'phosphorus': 18, 'potassium': 220, 'organic_carbon': 0.55, 'texture': 'Red and Laterite', 'soil_quality': 'medium'},
    'assam': {'ph': 5.5, 'nitrogen': 380, 'phosphorus': 15, 'potassium': 200, 'organic_carbon': 0.75, 'texture': 'Alluvial and Laterite', 'soil_quality': 'medium'},
    'bihar': {'ph': 7.0, 'nitrogen': 280, 'phosphorus': 10, 'potassium': 160, 'organic_carbon': 0.45, 'texture': 'Alluvial', 'soil_quality': 'low'},
    'chhattisgarh': {'ph': 6.5, 'nitrogen': 350, 'phosphorus': 8, 'potassium': 250, 'organic_carbon': 0.60, 'texture': 'Red and Black', 'soil_quality': 'medium'},
    'gujarat': {'ph': 7.9, 'nitrogen': 300, 'phosphorus': 12, 'potassium': 240, 'organic_carbon': 0.40, 'texture': 'Alluvial, Black, Desert', 'soil_quality': 'low'},
    'haryana': {'ph': 8.1, 'nitrogen': 280, 'phosphorus': 15, 'potassium': 220, 'organic_carbon': 0.40, 'texture': 'Alluvial and Arid', 'soil_quality': 'medium'},
    'jharkhand': {'ph': 6.0, 'nitrogen': 320, 'phosphorus': 10, 'potassium': 180, 'organic_carbon': 0.50, 'texture': 'Red and Laterite', 'soil_quality': 'medium'},
    'karnataka': {'ph': 6.8, 'nitrogen': 340, 'phosphorus': 16, 'potassium': 230, 'organic_carbon': 0.50, 'texture': 'Red and Laterite', 'soil_quality': 'medium'},
    'kerala': {'ph': 5.5, 'nitrogen': 360, 'phosphorus': 12, 'potassium': 200, 'organic_carbon': 0.65, 'texture': 'Laterite', 'soil_quality': 'medium'},
    'madhya pradesh': {'ph': 7.2, 'nitrogen': 400, 'phosphorus': 10, 'potassium': 300, 'organic_carbon': 0.55, 'texture': 'Black, Red, Alluvial', 'soil_quality': 'medium'},
    'maharashtra': {'ph': 7.5, 'nitrogen': 320, 'phosphorus': 14, 'potassium': 220, 'organic_carbon': 0.45, 'texture': 'Black and Red', 'soil_quality': 'medium'},
    'odisha': {'ph': 6.3, 'nitrogen': 300, 'phosphorus': 9, 'potassium': 210, 'organic_carbon': 0.50, 'texture': 'Red and Laterite', 'soil_quality': 'low'},
    'punjab': {'ph': 8.2, 'nitrogen': 260, 'phosphorus': 25, 'potassium': 200, 'organic_carbon': 0.40, 'texture': 'Alluvial', 'soil_quality': 'medium'},
    'rajasthan': {'ph': 8.0, 'nitrogen': 280, 'phosphorus': 10, 'potassium': 260, 'organic_carbon': 0.35, 'texture': 'Desert and Alluvial', 'soil_quality': 'low'},
    'tamil nadu': {'ph': 7.0, 'nitrogen': 310, 'phosphorus': 18, 'potassium': 240, 'organic_carbon': 0.45, 'texture': 'Red and Laterite', 'soil_quality': 'medium'},
    'telangana': {'ph': 7.4, 'nitrogen': 330, 'phosphorus': 16, 'potassium': 230, 'organic_carbon': 0.50, 'texture': 'Black and Red', 'soil_quality': 'medium'},
    'uttar pradesh': {'ph': 7.8, 'nitrogen': 250, 'phosphorus': 8, 'potassium': 180, 'organic_carbon': 0.45, 'texture': 'Alluvial', 'soil_quality': 'medium'},
    'west bengal': {'ph': 6.9, 'nitrogen': 340, 'phosphorus': 25, 'potassium': 200, 'organic_carbon': 0.75, 'texture': 'Alluvial and Deltaic', 'soil_quality': 'high'},
    'delhi': {'ph': 7.6, 'nitrogen': 270, 'phosphorus': 14, 'potassium': 190, 'organic_carbon': 0.35, 'texture': 'Alluvial', 'soil_quality': 'low'},
    'jammu and kashmir': {'ph': 7.0, 'nitrogen': 360, 'phosphorus': 10, 'potassium': 160, 'organic_carbon': 0.70, 'texture': 'Loamy and Alluvial', 'soil_quality': 'medium'},
    'chandigarh': {'ph': 7.5, 'nitrogen': 290, 'phosphorus': 16, 'potassium': 220, 'organic_carbon': 0.40, 'texture': 'Alluvial', 'soil_quality': 'medium'},
    'default': {'ph': 7.2, 'nitrogen': 320, 'phosphorus': 15, 'potassium': 220, 'organic_carbon': 0.50, 'texture': 'Loamy', 'soil_quality': 'medium'}
}

def geocode_city(city):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": city, "format": "json", "limit": 1}
    headers = {"User-Agent": "cropwiseai/1.0"}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise ValueError(f"City '{city}' not found")
        return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        raise

def fetch_soil_data(location):
    state = None
    location_lower = location.lower().strip()
    if location_lower in CITY_TO_STATE:
        state = CITY_TO_STATE[location_lower]
    else:
        for key in SOIL_DATA.keys():
            if key in location_lower or location_lower in key:
                state = key
                break
        if not state:
            state = 'default'
    soil = SOIL_DATA.get(state, SOIL_DATA['default']).copy()
    if 'loamy' in soil['texture'].lower() or 'alluvial' in soil['texture'].lower():
        soil['clay'] = 25; soil['sand'] = 45; soil['silt'] = 30
    elif 'clayey' in soil['texture'].lower() or 'black' in soil['texture'].lower():
        soil['clay'] = 40; soil['sand'] = 30; soil['silt'] = 30
    elif 'sandy' in soil['texture'].lower() or 'desert' in soil['texture'].lower():
        soil['clay'] = 10; soil['sand'] = 70; soil['silt'] = 20
    elif 'laterite' in soil['texture'].lower():
        soil['clay'] = 35; soil['sand'] = 40; soil['silt'] = 25
    else:
        soil['clay'] = 20; soil['sand'] = 50; soil['silt'] = 30
    soil['state'] = state
    return soil

def fetch_weather_data(lat, lon):
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": WEATHER_API_KEY, "units": "metric"}
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return {
            "temp": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "weather": data["weather"][0]["description"]
        }
    except Exception as e:
        raise

def gemini_api_call(prompt):
    global current_groq_key_index
    while current_groq_key_index < len(GROQ_API_KEYS):
        try:
            client = get_groq_client()
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1600,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            error_str = str(e).lower()
            if "rate limit" in error_str or "429" in error_str or "quota" in error_str or "invalid api key" in error_str:
                current_groq_key_index += 1
                continue
            else:
                raise
    raise ValueError("All Groq API keys exhausted.")

def get_user_data(location, farm_size, farm_size_unit, last_crop, crop_type):
    data = {
        "city": location,
        "farm_size": float(farm_size),
        "farm_size_unit": farm_size_unit.lower(),
        "last_crop": last_crop or "None",
        "crop_type": crop_type.lower()
    }
    if data["farm_size_unit"] not in UNIT_CONVERSIONS:
        raise ValueError("Invalid unit")
    data["farm_size_acres"] = data["farm_size"] * UNIT_CONVERSIONS[data["farm_size_unit"]]
    return data

def get_crop_recommendation(user_data, soil_data, weather_data):
    state = soil_data.get('state', 'default').capitalize()
    crop_type = user_data['crop_type']
    prompt = f"""
    Recommend exactly **4 field-grown {crop_type.lower()}** for high profit in **{state}**.
    Farm size: {user_data['farm_size_acres']} acres, City: {user_data['city']}, Last crop: {user_data['last_crop']}
    Soil: pH={soil_data['ph']}, N={soil_data['nitrogen']}, P={soil_data['phosphorus']}, K={soil_data['potassium']}, texture={soil_data['texture']}
    Weather: temp={weather_data['temp']}°C, humidity={weather_data['humidity']}%, condition={weather_data['weather']}

    Output Format (Plain Text Only):
    Crop 1:
    Name: [name]
    Reason: [reason]
    Expected Yield: [tons/acre]
    Water Requirements: [mm/season]
    Current Market Price: ₹[price]/kg
    Expected Investment: ₹[cost for {user_data['farm_size_acres']} acres]
    Expected Revenue: ₹[revenue for {user_data['farm_size_acres']} acres]

    (Repeat for Crop 2, 3, 4)
    """
    return gemini_api_call(prompt)

def parse_recommendation_to_crops(recommendation_text, state):
    crops = []
    current_crop = {}
    for line in recommendation_text.split('\n'):
        line = line.strip()
        if not line: continue
        clean = re.sub(r'\*\*?|__|^#+\s*|^[\*\-]\s*', '', line).strip()
        if re.match(r'Crop \d+:', clean):
            if current_crop:
                crops.append(current_crop)
            current_crop = {}
            if len(crops) >= 4: break
        elif ':' in clean:
            key, value = clean.split(':', 1)
            key = key.strip().lower().replace(' ', '_')
            value = re.sub(r'[\U0001F000-\U0001FFFF]', '', value.strip()).strip()
            if key == 'name': current_crop['name'] = value
            elif key == 'reason': current_crop['season'] = value
            elif key == 'expected_yield': current_crop['expectedYield'] = value
            elif key == 'water_requirements': current_crop['waterRequirement'] = value
            elif key == 'current_market_price': current_crop['profitMargin'] = value
            current_crop['suitability'] = 85
    if current_crop and len(crops) < 4:
        crops.append(current_crop)
    while len(crops) < 4:
        crops.append({'name': f"Placeholder Crop {len(crops)+1}", 'season': 'N/A', 'expectedYield': 'N/A', 'waterRequirement': 'N/A', 'profitMargin': 'N/A', 'suitability': 50})
    return crops[:4]

def generate_pdf_in_memory(recommendation, user_data, soil_data):
    if not PDF_LIB_AVAILABLE: return None
    recommendation = re.sub(r'\*\*?|__|^#+\s*|^[\*\-]\s*', '', recommendation, flags=re.MULTILINE)
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=letter)
    width, height = letter
    left_margin = 50
    y = height - 50
    use_dejavu = True
    try:
        pdfmetrics.registerFont(TTFont('DejaVuSans', 'DejaVuSans.ttf'))
        c.setFont('DejaVuSans', 12)
    except:
        c.setFont('Helvetica', 12)
        use_dejavu = False
        recommendation = recommendation.replace("₹", "Rs. ")
    font = 'DejaVuSans' if use_dejavu else 'Helvetica'
    c.setFont(font, 16)
    c.drawCentredString(width/2, y, f"Crop Recommendations - {datetime.now().strftime('%Y-%m-%d')}")
    y -= 30
    c.setFont(font, 10)
    for line in recommendation.split('\n'):
        if line.strip():
            if y < 50: c.showPage(); y = height - 50; c.setFont(font, 10)
            c.drawString(left_margin, y, line.strip()[:90])
            y -= 14
    c.save()
    packet.seek(0)
    return base64.b64encode(packet.getvalue()).decode('utf-8')

# Flask App
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        if not data or 'location' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        user_data = get_user_data(data['location'], data['farm_size'], data['farm_size_unit'], data.get('last_crop', ''), data.get('crop_type', ''))
        soil_data = fetch_soil_data(user_data["city"])
        lat, lon = geocode_city(user_data["city"])
        weather_data = fetch_weather_data(lat, lon)
        recommendation = get_crop_recommendation(user_data, soil_data, weather_data)
        crops = parse_recommendation_to_crops(recommendation, soil_data.get('state', 'default'))
        pdf_base64 = generate_pdf_in_memory(recommendation, user_data, soil_data)
        return jsonify({'crops': crops, 'pdf_base64': pdf_base64})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reverse-geocode', methods=['GET'])
def reverse_geocode():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"format": "json", "lat": lat, "lon": lon, "addressdetails": 1, "accept-language": "en"}
    headers = {"User-Agent": "krishimitraai/1.0"}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        return jsonify(resp.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
