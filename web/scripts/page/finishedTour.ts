// The welcome tour's progress as the app saves it once the tour is finished (saveTourProgress in
// src/settings/settingsStore.ts), for `reset --toured` to open the app straight to a usable globe.
export const finishedTour = { key: 'scoremap.welcomeTour', value: JSON.stringify('finished') }
