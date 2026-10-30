// createSwipe returns touch handlers that call onSwipeLeft for a right-to-left swipe:
// mostly horizontal, at least 60px.
export function createSwipe(onSwipeLeft) {
  let start
  return {
    onTouchStart: (e) => (start = e.touches.length === 1 && { x: e.touches[0].clientX, y: e.touches[0].clientY }),
    onTouchEnd: (e) => {
      const t = e.changedTouches[0]
      if (start && start.x - t.clientX > 60 && Math.abs(t.clientY - start.y) < 40) onSwipeLeft()
      start = null
    },
  }
}
