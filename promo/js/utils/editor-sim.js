// Virtual Editor Typing Simulator
export function simulateTyping(element, text, speed = 60, onComplete = null) {
  element.value = '';
  let i = 0;
  function step() {
    if (i < text.length) {
      element.value += text[i++];
      // Trigger input event to update previews dynamically
      element.dispatchEvent(new Event('input'));
      setTimeout(step, speed + Math.random() * 20);
    } else if (onComplete) {
      onComplete();
    }
  }
  step();
}
