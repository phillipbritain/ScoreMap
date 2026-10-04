# MapLibre GL for the globe

The globe is rendered with MapLibre GL's globe projection over vector map tiles, not a three.js textured sphere such as globe.gl. A realistic textured Earth looks more striking, but it blurs when zoomed in and has no built-in borders, place labels or clustering. ScoreMap needs crowded areas to stay readable and needs clear borders and city names for its geography goal. A satellite style can be added later as an alternative map style.
