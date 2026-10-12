/**
 * How far a score card can move from one frame to the next before a viewer sees it jump, in pixels.
 * The tests of placement as the globe turns count moves further than this as jumps, and the layout
 * pushes a card no further than this to keep it on screen.
 */
export const cardJump = 24
