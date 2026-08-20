const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export interface NameChangeEligibility {
  canChange: boolean
  nextEligibleAt: Date | null
  daysRemaining: number
}

/**
 * Nama cuma boleh diganti sekali per 30 hari sejak perubahan terakhir.
 * `nameUpdatedAt` null berarti belum pernah diisi (atau sudah lewat masa
 * cooldown-nya), jadi selalu boleh diganti.
 */
export function getNameChangeEligibility(nameUpdatedAt: string | null | undefined): NameChangeEligibility {
  if (!nameUpdatedAt) {
    return { canChange: true, nextEligibleAt: null, daysRemaining: 0 }
  }

  const lastChanged = new Date(nameUpdatedAt).getTime()
  const nextEligibleAt = new Date(lastChanged + COOLDOWN_MS)
  const msRemaining = nextEligibleAt.getTime() - Date.now()

  if (msRemaining <= 0) {
    return { canChange: true, nextEligibleAt: null, daysRemaining: 0 }
  }

  return {
    canChange: false,
    nextEligibleAt,
    daysRemaining: Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
  }
}
