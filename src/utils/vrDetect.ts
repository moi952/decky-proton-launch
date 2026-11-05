export interface VrInfo {
  vr: boolean;
  vrOnly: boolean;
}

// Steam's own store category ids ("VR Only" / "VR Supported") and the VR
// store tag — read off the game's overview, which Steam keeps in memory, so
// looking up a whole library costs next to nothing.
const CATEGORY_VR_ONLY = 54;
const CATEGORY_VR_SUPPORTED = 53;
const TAG_VR = 21978;

const NOT_VR: VrInfo = { vr: false, vrOnly: false };

export const getVrInfo = (appid: number): VrInfo => {
  try {
    const overview = (window as any).appStore?.GetAppOverviewByAppID?.(appid);
    if (!overview) return NOT_VR;
    const categories = Array.from(overview.store_category ?? []) as number[];
    const tags = Array.from(overview.store_tag ?? []) as number[];
    const vrOnly = categories.includes(CATEGORY_VR_ONLY);
    // The categories alone miss non-Steam games (they carry none), and
    // BSupportsVR() alone misses some Steam games the store tags as VR —
    // either one counts.
    const vr =
      vrOnly ||
      categories.includes(CATEGORY_VR_SUPPORTED) ||
      tags.includes(TAG_VR) ||
      Boolean(overview.BSupportsVR?.());
    return { vr, vrOnly };
  } catch {
    return NOT_VR;
  }
};
