export type SpiItem = {
  rank: number
  teamName: string
  spiScore: number
  region: string
  isD3: boolean
  prevSeasonRank?: number
}

// ── Master SPI Reference Datasets (Empty defaults — populated via Admin SPI Upload) ────

export const TEAM_SPI_WOMEN: SpiItem[] = []
export const TEAM_SPI_MEN: SpiItem[] = []
export const EPEE_SPI_WOMEN: SpiItem[] = []
export const EPEE_SPI_MEN: SpiItem[] = []
export const FOIL_SPI_WOMEN: SpiItem[] = []
export const FOIL_SPI_MEN: SpiItem[] = []
export const SABER_SPI_WOMEN: SpiItem[] = []
export const SABER_SPI_MEN: SpiItem[] = []

export type CategorySpiData = {
  title: string
  items: SpiItem[]
}

export const SPI_BY_CATEGORY: Record<string, CategorySpiData> = {
  men_team_overall: { title: "Men's Team Overall SPI", items: TEAM_SPI_MEN },
  men_team_diii: { title: "Men's Team Division III SPI", items: TEAM_SPI_MEN.filter((t) => t.isD3) },
  men_squad_epee_overall: { title: "Men's Epee Squad SPI", items: EPEE_SPI_MEN },
  men_squad_foil_overall: { title: "Men's Foil Squad SPI", items: FOIL_SPI_MEN },
  men_squad_sabre_overall: { title: "Men's Saber Squad SPI", items: SABER_SPI_MEN },
  women_team_overall: { title: "Women's Team Overall SPI", items: TEAM_SPI_WOMEN },
  women_team_diii: { title: "Women's Team Division III SPI", items: TEAM_SPI_WOMEN.filter((t) => t.isD3) },
  women_squad_epee_overall: { title: "Women's Epee Squad SPI", items: EPEE_SPI_WOMEN },
  women_squad_foil_overall: { title: "Women's Foil Squad SPI", items: FOIL_SPI_WOMEN },
  women_squad_sabre_overall: { title: "Women's Saber Squad SPI", items: SABER_SPI_WOMEN },
}

export function getSpiRankingsForCategory(categorySlug: string): CategorySpiData | null {
  return SPI_BY_CATEGORY[categorySlug] ?? null
}
