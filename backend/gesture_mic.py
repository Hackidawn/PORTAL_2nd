from flask import Flask, jsonify
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import numpy as np
import base64
import time

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

mic_status = {"status": "on"}

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=True,  # Important: avoids timestamp mismatch
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

# Emit mic status changes to clients
def log_status_change(new_status):
    if mic_status["status"] != new_status:
        print(f"[{time.strftime('%H:%M:%S')}] Gesture detected: Mic {new_status.upper()}")
        mic_status["status"] = new_status
        socketio.emit('mic-status', {'status': new_status})

# Handle incoming frame from frontend
@socketio.on('frame')
def receive_frame(data):
    try:
        image_data = data['image'].split(",")[1]
        decoded = base64.b64decode(image_data)
        np_data = np.frombuffer(decoded, np.uint8)
        frame = cv2.imdecode(np_data, cv2.IMREAD_COLOR)

        if frame is not None:
            detect_gesture_from_frame(frame)
        else:
            print("⚠️ Received empty frame.")
    except Exception as e:
        print("❌ Error processing frame:", e)

# Core logic to detect index finger left/right gesture
def detect_gesture_from_frame(frame):
    try:
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(img_rgb)

        gesture = None

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                index = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                wrist = hand_landmarks.landmark[mp_hands.HandLandmark.WRIST]

                # Compare X coordinates: Left or Right
                delta_x = index.x - wrist.x

                if delta_x < -0.15:  # Index moved left => Mic OFF
                    gesture = "off"
                elif delta_x > 0.15:  # Index moved right => Mic ON
                    gesture = "on"

        if gesture:
            log_status_change(gesture)

    except Exception as e:
        print(f"⚠️ Gesture detection error: {e}")

@app.route('/status')
def get_status():
    return jsonify(mic_status)

if __name__ == '__main__':
    print("🌐 WebSocket server running at http://localhost:5001")
    socketio.run(app, port=5001)
