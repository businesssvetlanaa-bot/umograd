export const BUILDING_TYPE_MAX_LENGTH = 64
export const BUILDING_MAP_BOUNDS = { minX: 60, maxX: 740, minY: 60, maxY: 450 } as const
export const BUILDING_MUTEX_RETRY_AFTER_SECONDS = 1

export type BuildingPlacementInput = {
  building_type: string
  position_x: number
  position_y: number
}

export function parseBuildingPlacement(value: unknown): BuildingPlacementInput | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<BuildingPlacementInput>
  if (typeof candidate.building_type !== 'string'
    || candidate.building_type.length === 0
    || candidate.building_type.length > BUILDING_TYPE_MAX_LENGTH) return null
  if (typeof candidate.position_x !== 'number' || !Number.isFinite(candidate.position_x)
    || candidate.position_x < BUILDING_MAP_BOUNDS.minX || candidate.position_x > BUILDING_MAP_BOUNDS.maxX) return null
  if (typeof candidate.position_y !== 'number' || !Number.isFinite(candidate.position_y)
    || candidate.position_y < BUILDING_MAP_BOUNDS.minY || candidate.position_y > BUILDING_MAP_BOUNDS.maxY) return null
  return {
    building_type: candidate.building_type,
    position_x: candidate.position_x,
    position_y: candidate.position_y,
  }
}

type BuildingIdentity = { id: string; purchased_at: Date }

export function canonicalBuilding<T extends BuildingIdentity>(buildings: readonly T[]): T | undefined {
  let canonical: T | undefined
  for (const building of buildings) {
    if (!canonical
      || building.purchased_at.getTime() < canonical.purchased_at.getTime()
      || (building.purchased_at.getTime() === canonical.purchased_at.getTime() && building.id < canonical.id)) {
      canonical = building
    }
  }
  return canonical
}

type PublicBuilding = {
  id: string
  building_type: string
  placed: boolean
  position_x: number | null
  position_y: number | null
}

export function buildingPlacementResponse(building: PublicBuilding, coins: number, purchasedNow: boolean) {
  return {
    success: true as const,
    purchased_now: purchasedNow,
    coins,
    building: {
      id: building.id,
      building_type: building.building_type,
      placed: building.placed,
      position_x: building.position_x,
      position_y: building.position_y,
    },
  }
}

type QueueState = { tail: Promise<void>; pending: number }

export class BuildingPurchaseOverloadedError extends Error {
  readonly retryAfterSeconds = BUILDING_MUTEX_RETRY_AFTER_SECONDS

  constructor() {
    super('Building purchase queue is full')
    this.name = 'BuildingPurchaseOverloadedError'
  }
}

export class KeyedMutex {
  private readonly queues = new Map<string, QueueState>()

  constructor(
    private readonly maxKeys = 1_000,
    private readonly maxPendingPerKey = 20,
  ) {}

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    let state = this.queues.get(key)
    if (!state) {
      if (this.queues.size >= this.maxKeys) throw new BuildingPurchaseOverloadedError()
      state = { tail: Promise.resolve(), pending: 0 }
      this.queues.set(key, state)
    }
    if (state.pending >= this.maxPendingPerKey) throw new BuildingPurchaseOverloadedError()

    const previous = state.tail
    let release!: () => void
    state.tail = new Promise<void>((resolve) => { release = resolve })
    state.pending += 1
    await previous
    try {
      return await task()
    } finally {
      state.pending -= 1
      release()
      if (state.pending === 0 && this.queues.get(key) === state) this.queues.delete(key)
    }
  }

  activeKeys(): number {
    return this.queues.size
  }

  pendingFor(key: string): number {
    return this.queues.get(key)?.pending ?? 0
  }
}

export const buildingPurchaseMutex = new KeyedMutex()
