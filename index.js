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
const LASTFM_USERNAME = process.env.LASTFM_USERNAME;
const EMPTY_COVER = process.env.EMPTY_COVER;

if (!LASTFM_API_KEY || !LASTFM_USERNAME) {
    console.error('Missing LASTFM_API_KEY or LASTFM_USERNAME in environment variables.');
    process.exit(1);
}


const CONFIG = {
    num_bars: 37,
    gap_size: 2,
    bar_width: 4,
    bar_color: '#73becb',
    bar_length: 6,
    get container_width() {

        return this.num_bars * this.bar_width + (this.num_bars - 1) * this.gap_size;
    },
    css_bar: ''
};


function truncateText(text, maxWidth, charWidth = 7) {
    const maxChars = Math.floor(maxWidth / charWidth);
    return text.length > maxChars ? text.slice(0, maxChars - 3) + '...' : text;
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

async function getLatestTrackData() {
    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${LASTFM_USERNAME}&api_key=${LASTFM_API_KEY}&format=json`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Error fetching data: ${response.status} ${response.statusText}`);
            return { error: 'Error fetching data' };
        }

        const data = await response.json();

        if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
            const track = data.recenttracks.track[0];
            const nowPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
            const title = truncateText(track.name, 220);
            const artist = truncateText(track.artist['#text'], 185);
            let coverUrl = track.image && track.image.length > 0 ? track.image[track.image.length - 1]['#text'] : null;


            if (coverUrl === 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png') {
                coverUrl = `${EMPTY_COVER,fetchBackgroundAsBase64(EMPTY_COVER)}`;
            }

            const cover = coverUrl === "database64" ? "" : await fetchImageAsBase64(coverUrl);

            if (!nowPlaying && data.recenttracks.track.length > 0) {
                const recentTrack = data.recenttracks.track[0];
                let recentCoverUrl = recentTrack.image && recentTrack.image.length > 0 ? recentTrack.image[recentTrack.image.length - 1]['#text'] : null;


                if (recentCoverUrl === 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png') {
                    recentCoverUrl = `${EMPTY_COVER,fetchBackgroundAsBase64(EMPTY_COVER)}`;
                }

                const recentCover = recentCoverUrl === "database64" ? "" : await fetchImageAsBase64(recentCoverUrl);
                return {
                    nowPlaying: false,
                    title: truncateText(recentTrack.name, 220),
                    artist: truncateText(recentTrack.artist['#text'], 185),
                    cover: recentCover || '/placeholder.png',
                    bar_color: CONFIG.bar_color,
                    bar_positions: Array.from({ length: CONFIG.num_bars }, (_, i) => i * (CONFIG.bar_width + CONFIG.gap_size)), // Default positions
                    bar_width: CONFIG.bar_width,
                    bar_length: CONFIG.bar_length,
                    container_width: CONFIG.container_width
                };
            }

            return {
                nowPlaying,
                title,
                artist,
                cover: cover || '/placeholder.png',
                bar_color: CONFIG.bar_color,
                bar_positions: nowPlaying ? Array.from({ length: CONFIG.num_bars }, (_, i) => i * (CONFIG.bar_width + CONFIG.gap_size)) : [],
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


app.get('/now-playing', async (req, res) => {
    const trackData = await getLatestTrackData();
    res.setHeader('Content-Type', 'image/svg+xml');
    res.render('now-playing.html.j2', trackData);
});


app.get('/saikokurami', async (req, res) => {
    const trackData = await getLatestTrackData();


    const backgroundUrl = req.query.bg;
    if (backgroundUrl) {
        console.log('Background URL:', backgroundUrl);
        const backgroundBase64 = await fetchBackgroundAsBase64(backgroundUrl);
        if (backgroundBase64) {
            trackData.backgroundImage = backgroundBase64;
        } else {
            console.error('Failed to convert background image to Base64.');
        }
    } else {
        console.log('No background URL provided.');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.render('now-playing.html.j2', trackData);
});


app.get('/', (req, res) => {
    res.send('Welcome! Visit <a href="/now-playing">/now-playing</a> to see the latest track.');
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
