# Preset Slot And Ring Role Model

Ringconf 2.7.10 keeps the historic wedding-ring storage contract and adds two optional slots for additional presentation roles.

## Slots

The canonical slot definitions live in `src/app/preset-slots.ts`.

| Slot | Database key | Role | Label |
| --- | --- | --- | --- |
| `0` | `preset_0` | `wedding-female` | Damen-Trauring |
| `1` | `preset_1` | `wedding-male` | Herren-Trauring |
| `2` | `preset_2` | `engagement` | Verlobungsring |
| `3` | `preset_3` | `memoire` | Memoirering |

`preset_0` and `preset_1` remain required because existing clients and RPC payloads depend on them. `preset_2` and `preset_3` are optional fields and may be `NULL` or absent in older payloads.

## Persistence

Standalone PHP and the WooCommerce plugin both migrate their preset tables idempotently by adding `preset_2` and `preset_3` when missing. They do not rebuild existing snapshots.

The save RPC accepts the old two-ring request shape and the new optional slot object. If an old client saves without `preset_2` or `preset_3`, the server preserves the existing optional slot values instead of overwriting them with empty data. This is the compatibility guard that prevents old clients from deleting engagement or memoire presets.

## Angular contract

Angular serializes slots through `serializeExistingPresetSlots`, `serializeOptionalPresetSlots`, and `createPresetSaveCacheItem`. Loading uses `cloneLoadedPresetSlots`, which clones only present string payloads into existing ring instances.

Unknown AppData or RingData fields are not reconstructed or filtered by this layer. The slot helpers only decide which complete ring JSON belongs to which storage key.

## Ring roles

The role is presentation metadata, not a replacement for RingData. RingData remains the product state used by price, engraving, stones, and persistence. Presentation roles are used to address visible roots and camera focus consistently across four possible rings.

