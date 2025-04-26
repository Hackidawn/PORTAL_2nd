# ok_server.py
from flask import Flask, request
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import numpy as np
import base64
import time
import math

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6
)

last_trigger_times = {}

@socketio.on('frame')
def receive_frame(data):
    try:
        if not data or 'image' not in data:
            return
        image_data = data['image'].split(",")[1]
        decoded = base64.b64decode(image_data)
        np_data = np.frombuffer(decoded, np.uint8)
        frame = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
        if frame is None or frame.size == 0:
            return
        detect_ok_sign(frame, request.sid)
    except Exception as e:
        print(f"Error processing frame: {e}")

def detect_ok_sign(frame, sid):
    global last_trigger_times
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
            index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]

            dist = math.sqrt(
                (thumb_tip.x - index_tip.x) ** 2 +
                (thumb_tip.y - index_tip.y) ** 2 +
                (thumb_tip.z - index_tip.z) ** 2
            )
            if dist < 0.05:
                current_time = time.time()
                last_time = last_trigger_times.get(sid, 0)
                if current_time - last_time > 3:
                    socketio.emit('ok-sign-detected', {}, room=sid)
                    print(f"[{time.strftime('%H:%M:%S')}] 👌 OK Sign detected!")
                    last_trigger_times[sid] = current_time

if __name__ == '__main__':
    print("👌 OK Sign Detection Server running at http://localhost:5005")
    socketio.run(app, host="0.0.0.0", port=5005)
