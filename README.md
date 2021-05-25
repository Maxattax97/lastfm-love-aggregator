# LastFM Love Aggregator
Collects loved music and cleans up the metadata using MusicBrainz API.

# Setup

You must have the `fpcalc` (Chromaprint music fingerprinter) command available
on your system. See [here](https://github.com/parshap/node-fpcalc) for more
details.

```
npm install
```

# Usage

At the moment, pagination isn't implemented, and the LastFM API allows listing up to 1000 loved songs. So you'll probably want this:

```
./index.js -u Maxattax97 -l 1000 -k 1000
```

# Maintenance

If you receive something like:

```
ERROR: No video formats found; please report this issue on https://yt-dl.org/bug . Make sure you are using the latest version; type  youtube-dl -U  to update. Be sure to call youtube-dl with the --verbose flag and include its complete output.
```

You'll need to update _Node's_ `youtube-dl`... To do that, run:

```
./node_modules/youtube-dl/bin/youtube-dl -U
```

# Known bugs

- Strip `:/?"`... are there more characters?
