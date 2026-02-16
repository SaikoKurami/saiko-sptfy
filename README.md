# Saiko Spotify Now Playing

A simple project to display your currently playing or recently played track from Last.fm as an SVG image. You can customize the bar colors and other visual elements.

## Features
- Displays the currently playing track or the most recently played track.
- Customizable bar colors and styles.
- Outputs an SVG image that can be embedded anywhere.

## Demo
![Saiko Spotify Now Playing](https://saiko-sptfy-v7dt.onrender.com/saikokurami/)

![Saiko Spotify Now Playing](https://saiko-sptfy-v7dt.onrender.com/saikokurami/?bg=https://saikokurami.github.io/assets/sptfy-background.png)
## Getting Started

### Prerequisites
- Installed [Node.js](https://nodejs.org/).
- A Last.fm account with an API key.

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
   ```

   Replace `your_lastfm_api_key` and `your_lastfm_username` with your Last.fm API key and username.

### Running the Project
Start the server:
```bash
npm start
```

The server will run at `http://localhost:3000`.

### Endpoints
- `/now-playing`: Displays the currently playing track or the most recently played track as an SVG.
- `/saikokurami`: A custom endpoint showcasing the same functionality.

## Customization

You can customize the bar colors and styles by modifying the `CONFIG` object in `index.js`:
```javascript
const CONFIG = {
    num_bars: 37,         // Number of bars
    gap_size: 2,          // Gap size in pixels
    bar_width: 4,         // Width of each bar
    bar_color: '#73becb', // Bar color (customize this)
    bar_length: 6,        // Height of each bar
    // ...existing code...
};
```

Change the `bar_color` property to any valid CSS color to customize the bar color.

## Showcase
Embed the SVG in your project or website:
```html
<img src="https://saiko-sptfy-v7dt.com/saikokurami/">
```

## Contributing
Feel free to fork this repository and submit pull requests. Contributions are welcome!

## License
This project is licensed under the MIT License.
