# Map fonts from OpenFreeMap’s Liberty style

The globe uses OpenFreeMap for both map tiles and label glyphs. ScoreMap initially used a separate OpenMapTiles glyph server for Open Sans. A side-by-side preview showed that Liberty’s Noto Sans worked with ScoreMap’s labels, so the owner chose it to remove the extra runtime dependency. The globe inherits the glyph URL from the fetched Liberty style.

The theme can choose Noto Sans Regular, Bold, or Italic, the fonts used by Liberty. ScoreMap uses Regular for city and state labels and Bold for country labels and cluster counts.
