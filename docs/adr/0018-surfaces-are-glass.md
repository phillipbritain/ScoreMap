# Surfaces over the globe are glass

Every surface laid over the globe (score cards, the game panel, the rail and its popovers and toast, the scenario controls and the no-pins message) was a solid or see-through fill, so where games crowd or a popover is open the globe behind them was lost. We make them panes of glass instead, after Apple's Liquid Glass: the globe shows through, blurred as far as the glass is frosted, lifted in colour, and on the larger panes slightly bent, with edges that catch the light. A prototype tried three glass materials on the running app (clear "liquid" glass, frosted acrylic and smoked glass); the clear one won.

How frosted each is a theme setting, its component's **frost**, from 0, clear glass, to 1, opaque frosted glass; the built-in theme's are all 0.6. The glass is tinted with the component's own surface colour from the theme, as solid as its frost, so the palette still colours it. What the frost works out (how far the globe blurs, how much its colour is lifted, how bright the edges and sheen are, the lens's warp) is the glass's own and stays in the CSS, as motion does.

## Consequences

- `components.ScoreCard.fillOpacity` goes: a score card's frost is how opaque its fill is. A card's header tint, its status glow inside it and its logo plates clear with its frost too, so at 0 a card is only its edge, text, logos and status light; its glow outside and its outline keep its status look. The game panel's score block, score boxes and logo plates clear with its frost likewise, the score block never all the way.
- A hovered score card whose theme turns it solid (`components.Hover.card.solid`) frosts over fully instead.
- Logos drawn for a light background are harder to see on clear glass, the trade the logo plates were there for.
- Panels and controls now cast a soft shadow onto the globe with their glass, beside the theme's own drop shadows.
- The lens is an SVG filter in the page's backdrop filter, which Chromium draws; other browsers are untried. Score cards are too small for it to read as more than a smear, so they have none.
- Tooltips are glass too, drawn by the page rather than the browser, whose own can't be styled: anything with a `title` shows it in one, so the parts of the page set titles as before.
- A surface holding another glass surface (a rail group its popover, the scenario pill its list) draws its glass on a layer behind its content, since glass on a surface keeps the glass inside it from seeing past it.
