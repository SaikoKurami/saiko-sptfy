
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';
import nunjucks from 'nunjucks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

nunjucks.configure('views', {
    autoescape: true,
    express: app
});

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const EMPTY_COVER = process.env.EMPTY_COVER;

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

const LASTFM_DEFAULT_COVER =
    'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';

if (!LASTFM_API_KEY) {
    console.error('Missing LASTFM_API_KEY in environment variables.');
    process.exit(1);
}

// ===== CONFIGURATION =====

const CONFIG = {
    num_bars: 37,
    gap_size: 2,
    bar_width: 4,
    bar_color: '#73becb',
    text_color: '#ffffff',
    bar_length: 6,

    get container_width() {
        return this.num_bars * this.bar_width +
            (this.num_bars - 1) * this.gap_size;
    }
};

// ===== TEXT FUNCTIONS =====

function containsJapanese(text) {
    return /[\u3000-\u30FF\u4E00-\u9FFF]/.test(text);
}

function truncateText(text, maxWidth) {
    text = String(text || '');

    const isJapanese = containsJapanese(text);
    const charWidth = isJapanese ? 14 : 7;
    const maxChars = Math.floor(maxWidth / charWidth);

    return text.length > maxChars
        ? text.slice(0, Math.max(0, maxChars - 1)) + '…'
        : text;
}

function formatTimeAgo(unixTimestamp) {
    const playedAt = Number(unixTimestamp) * 1000;

    if (!Number.isFinite(playedAt)) return '';

    const diffMs = Math.max(0, Date.now() - playedAt);

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60)
        return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;

    if (minutes < 60)
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    if (hours < 24)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ===== IMAGE FETCHER =====

async function fetchImageAsBase64(url) {
    if (!url) return null;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Saiko-Spotify-Now-Playing/2.0'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || '';

        if (!contentType.startsWith('image/')) return null;

        const buffer = await response.arrayBuffer();

        if (buffer.byteLength > 10 * 1024 * 1024) {
            console.error('Image exceeds 10 MB limit.');
            return null;
        }

        const base64 = Buffer.from(buffer).toString('base64');

        return `data:${contentType};base64,${base64}`;

    } catch (error) {
        console.error('Image conversion error:', error.message);
        return null;
    }
}

// ===== LAST.FM API REQUEST WITH RETRIES =====

async function fetchLastFmData(username) {
    const params = new URLSearchParams({
        method: 'user.getrecenttracks',
        user: username,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: '1'
    });

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(
                `${LASTFM_API_URL}?${params.toString()}`,
                {
                    headers: {
                        'User-Agent': 'Saiko-Spotify-Now-Playing/2.0'
                    },
                    signal: AbortSignal.timeout(15000)
                }
            );

            if (response.ok) {
                const data = await response.json();

                if (data.error) {
                    throw new Error(
                        `Last.fm API ${data.error}: ${data.message}`
                    );
                }

                return data;
            }

            const errorBody = await response.text();

            console.error(
                `Last.fm HTTP ${response.status}, attempt ${attempt}/${maxAttempts}:`,
                errorBody.slice(0, 500)
            );

            const retryable = [
                429, 500, 502, 503, 504
            ].includes(response.status);

            if (!retryable || attempt === maxAttempts) {
                throw new Error(
                    `Last.fm HTTP error: ${response.status}`
                );
            }

        } catch (error) {
            console.error(
                `Last.fm request failed (${attempt}/${maxAttempts}):`,
                error.message
            );

            if (attempt === maxAttempts) {
                throw error;
            }

            // Retry network errors and timeouts.
            if (
                error.message.startsWith('Last.fm API ') ||
                error.message.startsWith('Last.fm HTTP error:')
            ) {
                throw error;
            }
        }

        // Exponential backoff: 2 seconds, then 4 seconds.
        await new Promise(resolve =>
            setTimeout(
                resolve,
                2000 * Math.pow(2, attempt - 1)
            )
        );
    }

    throw new Error('Last.fm returned no data after retries.');
}

// ===== GET LATEST TRACK =====

async function getLatestTrackData(username, emptyCoverUrl) {
    try {
        const data = await fetchLastFmData(username);

        let tracks = data?.recenttracks?.track;

        if (!tracks) {
            return { error: 'No track data available' };
        }

        // Normalize single-track responses.
        if (!Array.isArray(tracks)) {
            tracks = [tracks];
        }

        const track = tracks[0];

        if (!track) {
            return { error: 'No track data available' };
        }

        const nowPlaying =
            track['@attr']?.nowplaying === 'true';

        const title = truncateText(track.name, 185);

        const artist = truncateText(
            track.artist?.['#text'] ||
            track.artist?.name ||
            '',
            300
        );

        if (!title || !artist) {
            return { error: 'Incomplete track information' };
        }

        // ===== PLAY TIME =====

        let timePlayed = '';

        if (nowPlaying) {
            timePlayed = 'Playing now';
        } else if (track.date?.uts) {
            timePlayed = formatTimeAgo(track.date.uts);
        }

        // ===== BAR NUMBER =====

        const defaultChars = 14;
        const defaultBars = 13;

        const barnumber = Math.min(
            Math.ceil(
                (timePlayed.length * defaultBars) /
                defaultChars
            ),
            CONFIG.num_bars
        );

        // ===== COVER LOGIC =====

        let cover = null;

        const images = Array.isArray(track.image)
            ? track.image
            : [];

        const coverUrl = images
            .map(image => image?.['#text'])
            .filter(Boolean)
            .pop();

        // 1. Last.fm album artwork.
        if (
            coverUrl &&
            coverUrl !== LASTFM_DEFAULT_COVER
        ) {
            cover = await fetchImageAsBase64(coverUrl);
        }

        // 2. Custom ?cover= parameter.
        if (!cover && emptyCoverUrl) {
            cover = await fetchImageAsBase64(emptyCoverUrl);
        }

        // 3. .env EMPTY_COVER.
        if (!cover && EMPTY_COVER) {
            cover = await fetchImageAsBase64(EMPTY_COVER);
        }

        // ===== RESPONSE =====

        return {
            nowPlaying,
            timePlayed,
            title,
            artist,
            cover,

            bar_color: CONFIG.bar_color,
            text_color: CONFIG.text_color,

            bar_positions: Array.from(
                { length: CONFIG.num_bars },
                (_, i) =>
                    i * (
                        CONFIG.bar_width +
                        CONFIG.gap_size
                    )
            ),

            bar_width: CONFIG.bar_width,
            bar_length: CONFIG.bar_length,
            container_width: CONFIG.container_width,
            barnumber
        };

    } catch (error) {
        console.error('Error fetching track:', error.message);

        return {
            error: error.message
        };
    }
}

// ===== MAIN ROUTE =====

app.get('/:username', async (req, res) => {
    const username = req.params.username;

    if (!username) {
        return res.status(400).send(
            'Username is required.'
        );
    }

    const emptyCoverUrl = req.query.cover || null;

    const trackData = await getLatestTrackData(
        username,
        emptyCoverUrl
    );

    if (trackData.error) {
        return res.status(502).send(
            `Last.fm error: ${trackData.error}`
        );
    }

    // ===== BACKGROUND IMAGE =====

    if (req.query.bg) {
        const backgroundBase64 =
            await fetchImageAsBase64(req.query.bg);

        if (backgroundBase64) {
            trackData.backgroundImage = backgroundBase64;
        }
    }

    // ===== BAR COLOR =====

    let barColor = req.query.barcolor;

    if (barColor) {
        barColor = barColor.trim();

        if (/^[0-9A-F]{3,6}$/i.test(barColor)) {
            barColor = `#${barColor}`;
        }

        if (
            /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(barColor) ||
            /^rgb\((\d{1,3},\s?\d{1,3},\s?\d{1,3})\)$/i.test(barColor) ||
            /^[a-z]+$/i.test(barColor)
        ) {
            trackData.bar_color = barColor;
        }
    }

    // ===== TEXT COLOR =====

    let textColor = req.query.textcolor;

    if (textColor) {
        textColor = textColor.trim();

        if (/^[0-9A-F]{3,6}$/i.test(textColor)) {
            textColor = `#${textColor}`;
        }

        if (
            /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(textColor) ||
            /^rgb\((\d{1,3},\s?\d{1,3},\s?\d{1,3})\)$/i.test(textColor) ||
            /^[a-z]+$/i.test(textColor)
        ) {
            trackData.text_color = textColor;
        }
    }

    // ===== SVG RESPONSE =====

    res.setHeader('Content-Type', 'image/svg+xml');

    res.setHeader(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
    );

    res.render('now-playing.html.j2', trackData);
});

// ===== HOME =====

app.get('/', (req, res) => {
    res.send(
        'Usage: http://localhost:3000/<lastfm-username>?cover=https://image-url.com/cover.png'
    );
});

// ===== SERVER =====

app.listen(PORT, () => {
    console.log(
        `Server running at http://localhost:${PORT}`
    );
});
