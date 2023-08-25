from flask import Flask, render_template
import json
import os

data_dir = os.path.join(os.path.dirname(__file__), 'output')

app = Flask(__name__)

@app.route('/')
@app.route('/main')
def index():
    with open(os.path.join(data_dir, 'main.json'), 'r', encoding='utf-8') as f:
        return render_template('index.html', data=json.load(f))

if __name__ == '__main__':
    app.debug = True
    app.run()