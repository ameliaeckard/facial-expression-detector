## Hamster Face Detection

An interactive facial expression detector that displays corresponding hamster images based on detected human expressions.

### Features
- Real-time facial expression detection using face-api.js
- 7 expression categories: neutral, happy, sad, angry, fearful, disgusted, surprised
- Custom hamster image display for each expression
- Webcam integration with live detection overlay
- Light/dark theme support
- Instant image switching with preloading

### Tech Stack
- HTML5/CSS3
- JavaScript (Vanilla)
- face-api.js (machine learning library)
- Canvas API

### File Structure
```
HamsterFace/
├── index.html
├── style.css
├── app.js
└── faces/
    ├── neutral.jpg
    ├── happy.jpg
    ├── sad.jpg
    ├── angry.jpg
    ├── disgusted.jpg
    └── surprised.jpg
```

### Customization
- Adjust detection sensitivity in `app.js`:
  - `CONFIDENCE_THRESHOLD`: 0.3-0.7 (default: 0.5)
  - `UPDATE_INTERVAL`: milliseconds between checks (default: 50)
  - `EXPRESSION_HOLD_TIME`: milliseconds to hold expression (default: 300)
