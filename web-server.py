from flask import Flask, render_template
import json
import os

data_dir = os.path.join(os.path.dirname(__file__), 'static', 'data')

app = Flask(__name__)

@app.route('/')
@app.route('/main')
def index():
    return render_template('index_js.html', filename='main')

@app.route('/postgame')
def postgame():
    return render_template('index_js.html', filename='postgame')

if __name__ == '__main__':
    app.debug = True
    app.run()
