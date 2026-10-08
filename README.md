# Hamster Face _(facial-expression-detector)_

A playful browser demo that maps detected facial expressions to matching hamster images.

## Background

This small computer-vision experiment uses face-api.js to detect seven expression categories from a webcam feed and swaps in a corresponding hamster image. It is kept as a lightweight creative CV project.

## Install

```bash
git clone https://github.com/ameliaeckard/facial-expression-detector.git
cd facial-expression-detector
python -m http.server 8000
```

## Usage

Open `http://localhost:8000`, allow webcam access, and the page will update the displayed hamster based on the detected expression.

Detection thresholds and timing can be adjusted in `app.js`.

## Maintainer

[Amelia Eckard](https://github.com/ameliaeckard)

## Contributing

Issues are welcome for bugs or documentation problems. Please open an issue before a substantial pull request.

## License

UNLICENSED © Amelia Eckard.
