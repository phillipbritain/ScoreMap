/** The selected game's details, separate from the small live scoreboard messages. */
export interface GameDetails {
  periodScores: { label: string; home: string | null; away: string | null }[]
  homeTotal: string | null
  awayTotal: string | null
  scoring: GameScoringPlay[]
  drives: GameDrive[]
  stats: GameStatTeam[]
  videos: GameVideo[]
  broadcasts: string[]
}

export interface GameScoringPlay {
  team: string
  text: string
  when: string | null
  homeScore: number | null
  awayScore: number | null
}

export interface GameDrive {
  team: string
  outcome: string | null
  scored: boolean
  plays: number | null
  yards: number | null
  duration: string | null
  start: string | null
  end: string | null
}

export interface GameStatTeam {
  team: string
  sections: {
    name: string
    columns: string[]
    players: { name: string; values: string[] }[]
  }[]
}

export interface GameVideo {
  title: string
  url: string
  duration: number | null
}
