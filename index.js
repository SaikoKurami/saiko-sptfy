import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';
import nunjucks from 'nunjucks';

dotenv.config();

const app = express();
const PORT = 3000;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const EMPTY_COVER = process.env.EMPTY_COVER;

if (!LASTFM_API_KEY) {
    console.error('Missing LASTFM_API_KEY in environment variables.');
    process.exit(1);
}

const CONFIG = {
    num_bars: 37,
    gap_size: 2,
    bar_width: 4,
    bar_color: '${barcolor}',
    text_color: '${textcolor}',
    bar_length: 6,
    get container_width() {
        return this.num_bars * this.bar_width + (this.num_bars - 1) * this.gap_size;
    },
    css_bar: ''
};

function containsJapanese(text) {
    return /[\u3000-\u30FF\u4E00-\u9FFF]/.test(text);
}

function truncateText(text, maxWidth) {
    const isJapanese = containsJapanese(text);

    // Japanese characters are visually wider
    const charWidth = isJapanese ? 14 : 7;

    const maxChars = Math.floor(maxWidth / charWidth);

    return text.length > maxChars
        ? text.slice(0, maxChars - 1) + '…'
        : text;
}


async function fetchBackgroundAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching background image: ${response.status} ${response.statusText}`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type');
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('Error converting background image to Base64:', error.message);
        return null;
    }
}

async function fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error fetching image: ${response.status} ${response.statusText}`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type');
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('Error converting image to Base64:', error.message);
        return null;
    }
}

async function getLatestTrackData(username) {
    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${LASTFM_API_KEY}&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Error fetching data: ${response.status} ${response.statusText}`);
            return { error: 'Error fetching data' };
        }

        const data = await response.json();

        if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
            const track = data.recenttracks.track[0];
            const nowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';

            const title = truncateText(track.name, 185);
            const artist = truncateText(track.artist['#text'], 300);

let coverUrl = track.image && track.image.length > 0
    ? track.image[track.image.length - 1]['#text']
    : null;

let cover = null;

if (
    coverUrl &&
    coverUrl !== 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png'
) {
    cover = await fetchImageAsBase64(coverUrl);
}

if (!cover) {
    cover = EMPTY_COVER;
}

            return {
                nowPlaying,
                title,
                artist,
                cover: cover || '/placeholder.png',
                bar_color: CONFIG.bar_color,
                bar_positions: Array.from(
                    { length: CONFIG.num_bars },
                    (_, i) => i * (CONFIG.bar_width + CONFIG.gap_size)
                ),
                bar_width: CONFIG.bar_width,
                bar_length: CONFIG.bar_length,
                container_width: CONFIG.container_width
            };
        } else {
            return { error: 'No track data available' };
        }
    } catch (error) {
        console.error('Error occurred:', error.message);
        return { error: error.message };
    }
}


app.get('/:username', async (req, res) => {
    const username = req.params.username;

    if (!username) {
        return res.status(400).send('Username is required.');
    }

    const trackData = await getLatestTrackData(username);

    const backgroundUrl = req.query.bg;
    if (backgroundUrl) {
        const backgroundBase64 = await fetchBackgroundAsBase64(backgroundUrl);
        if (backgroundBase64) {
            trackData.backgroundImage = backgroundBase64;
        }
    }

        let barColor = req.query.barcolor;

    if (barColor) {
        barColor = barColor.trim();


        if (/^[0-9A-F]{3,6}$/i.test(barColor)) {
            barColor = `#${barColor}`;
        }


        const isValidHex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(barColor);


        const isValidCSSColor =
            /^rgb\((\d{1,3},\s?\d{1,3},\s?\d{1,3})\)$/i.test(barColor) ||
            /^[a-z]+$/i.test(barColor);

        if (isValidHex || isValidCSSColor) {
            trackData.bar_color = barColor;
        }
    }



        let textColor = req.query.textcolor;

    if (textColor) {
        textColor = textColor.trim();


        if (/^[0-9A-F]{3,6}$/i.test(textColor)) {
            textColor = `#${textColor}`;
        }


        const isValidHex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(textColor);


        const isValidCSSColor =
            /^rgb\((\d{1,3},\s?\d{1,3},\s?\d{1,3})\)$/i.test(textColor) ||
            /^[a-z]+$/i.test(textColor);

        if (isValidHex || isValidCSSColor) {
            trackData.text_color = textColor;
        }
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.render('now-playing.html.j2', trackData);
});

app.get('/', (req, res) => {
    res.send('Usage: http://localhost:3000/<lastfm-username>?bg=https://image-url.com/bg.png');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
