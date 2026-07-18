export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement
    || (document as any).webkitFullscreenElement
    || (document as any).msFullscreenElement
  );
}

export function toggleFullscreen(element: HTMLElement | null, afterChange?: () => void): void {
  if (isFullscreen()) {
    const exit = document.exitFullscreen
      || (document as any).webkitExitFullscreen
      || (document as any).mozCancelFullScreen
      || (document as any).msExitFullscreen;
    const result = exit?.call(document);
    if (result && typeof result.then === "function") {
      result.then(afterChange).catch((err: unknown) => console.log("error in ExitFullscreen(): ", err));
    } else {
      afterChange?.();
    }
    return;
  }

  const request = element?.requestFullscreen
    || (element as any)?.webkitRequestFullscreen
    || (element as any)?.mozRequestFullScreen
    || (element as any)?.msRequestFullscreen;
  const result = request?.call(element);
  if (result && typeof result.then === "function") {
    result.then(afterChange).catch((err: unknown) => console.log("error in ToggleFullscreen(): ", err));
  } else {
    afterChange?.();
  }
}
