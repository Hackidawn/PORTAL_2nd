from flask import Flask, request
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import numpy as np
import base64

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins='*')

# Mediapipe Hands module
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

@socketio.on('frame')
def receive_frame(data):
    try:
        if not data or 'image' not in data:
            print("⚠️ No image data received.")
            return

        image_data = data['image'].split(",")[1]
        decoded = base64.b64decode(image_data)
        np_data = np.frombuffer(decoded, np.uint8)
        frame = cv2.imdecode(np_data, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            print("⚠️ Empty frame detected.")
            return

        detect_gesture(frame, request.sid)

    except Exception as e:
        print(f"❌ Error processing frame: {e}")

def detect_gesture(frame, sid):
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            thumb_tip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_TIP]
            thumb_ip = hand_landmarks.landmark[mp_hands.HandLandmark.THUMB_IP]
            index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
            middle_tip = hand_landmarks.landmark[mp_hands.HandLandmark.MIDDLE_FINGER_TIP]
            ring_tip = hand_landmarks.landmark[mp_hands.HandLandmark.RING_FINGER_TIP]
            pinky_tip = hand_landmarks.landmark[mp_hands.HandLandmark.PINKY_TIP]
            wrist = hand_landmarks.landmark[mp_hands.HandLandmark.WRIST]

            # Detect thumbs up (start recording)
            if (
                thumb_tip.y < index_tip.y and
                thumb_tip.y < middle_tip.y and
                thumb_tip.y < ring_tip.y and
                thumb_tip.y < pinky_tip.y and
                thumb_tip.y < wrist.y
            ):
                print("👍 Thumbs Up detected - Start recording")
                socketio.emit('start-recording', room=sid)
                return

            # Detect thumbs down (stop recording)
            if (
                thumb_tip.y > index_tip.y and
                thumb_tip.y > middle_tip.y and
                thumb_tip.y > ring_tip.y and
                thumb_tip.y > pinky_tip.y and
                thumb_tip.y > wrist.y
            ):
                print("👎 Thumbs Down detected - Stop recording")
                socketio.emit('stop-recording', room=sid)
                return
    else:
        print("👀 No hand detected.")


if __name__ == '__main__':
    print("🖥️ Gesture Detection Server running at http://localhost:5004")
    socketio.run(app, host="0.0.0.0", port=5004)
