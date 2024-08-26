from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/convert', methods=['POST'])
def convert():
    data = request.json
    url = data.get('url')
    # Burada Spotify'dan YouTube'a dönüştürme işlemini gerçekleştirin
    result = {"message": "Spotify URL successfully converted to YouTube URL"}
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
