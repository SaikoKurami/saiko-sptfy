# Saiko Spotify Now Playing

A simple project to display your currently playing or recently played track from Last.fm as an SVG image. You can customize the bar colors and other visual elements.

## Features

* Displays the currently playing track or the most recently played track.
* Customizable bar colors and styles.
* Outputs an SVG image that can be embedded anywhere.

## Demo

![Saiko Spotify Now Playing](https://saiko-sptfy-v7dt.onrender.com/saikokurami/)

![Saiko Spotify Now Playing with Background](https://saiko-sptfy-v7dt.onrender.com/saikokurami/?bg=https://saikokurami.github.io/assets/sptfy-background.png)

## Getting Started

### Prerequisites

* Installed [Node.js](https://nodejs.org/).
* A Last.fm account with an API key.

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/saiko-sptfy.git
   cd saiko-sptfy
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory and add the following:

   ```env
   LASTFM_API_KEY=your_lastfm_api_key
   LASTFM_USERNAME=your_lastfm_username
   EMPTY_COVER=data:image/png;base64,xxxxxxx
   ```

   * Replace `your_lastfm_api_key` and `your_lastfm_username` with your Last.fm API key and username.
   * Replace `EMPTY_COVER` with a Base64 string of a default cover image to use when the track has no cover.

### Running the Project

Start the server:

```bash
npm start
```

The server will run at `http://localhost:3000`.

### Endpoints

* `/:username` – Displays the currently playing track or the most recently played track as an SVG.
* Example: `/saikokurami` – A custom endpoint showcasing the same functionality.

### Query Parameters

* `bg` – URL to a background image.
* `barcolor` – Hex, RGB, or CSS color for bars.
* `textcolor` – Hex, RGB, or CSS color for text.

Example:

```
https://saiko-sptfy-v7dt.onrender.com/saikokurami/?bg=https://example.com/bg.png&barcolor=#73becb&textcolor=#ffffff
```

## Showcase

Embed the SVG in your project or website:

```html
<img src="https://saiko-sptfy-v7dt.onrender.com/saikokurami/">
```

## Contributing

Feel free to fork this repository and submit pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License.
