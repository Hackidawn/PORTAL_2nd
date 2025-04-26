# screenshot_server.py
from flask import Flask, request
from flask_socketio import SocketIO
import cv2, mediapipe as mp, numpy as np, base64, time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

hands = mp.solutions.hands.Hands(
    static_image_mode=False, max_num_hands=1,
    min_detection_confidence=0.7, min_tracking_confidence=0.7
)

last_trigger_times = {}

@socketio.on('frame')
def receive_frame(data):
    image_data = data['image'].split(",")[1]
    decoded = base64.b64decode(image_data)
    frame = cv2.imdecode(np.frombuffer(decoded, np.uint8), cv2.IMREAD_COLOR)
    detect_open_palm(frame, request.sid)

def detect_open_palm(frame, sid):
    global last_trigger_times
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            wrist = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.WRIST]
            thumb_tip = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.THUMB_TIP]
            index_tip = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.INDEX_FINGER_TIP]
            middle_tip = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.MIDDLE_FINGER_TIP]
            ring_tip = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.RING_FINGER_TIP]
            pinky_tip = hand_landmarks.landmark[mp.solutions.hands.HandLandmark.PINKY_TIP]

            finger_tips = [index_tip, middle_tip, ring_tip, pinky_tip]

            is_open_palm = (
                abs(wrist.x - thumb_tip.x) < 0.2 and
                all(tip.y < wrist.y for tip in finger_tips)
            )

            if is_open_palm:
                current_time = time.time()
                last_time = last_trigger_times.get(sid, 0)
                if current_time - last_time > 3:
                    print("🖐️ Open Palm detected, triggering screenshot!")
                    socketio.emit('take-screenshot', room=sid)
                    last_trigger_times[sid] = current_time

if __name__ == '__main__':
    print("📸 Screenshot Server running at http://localhost:5003")
    socketio.run(app, host='0.0.0.0', port=5003)
