import { trackEvent } from '../common/analytics.js';

export function initHome() {
  trackEvent('PageLoad', 'Home');

  // Typing Effect
  const typingEl = document.getElementById('hero-typing');
  if (typingEl) {
    const text = '완벽한 하나가 되다.';
    let idx = 0;
    function type() {
      if (idx < text.length) {
        typingEl.textContent += text[idx++];
        setTimeout(type, 120); // 한글 타이핑이므로 속도를 약간 늦춰 120ms로 세련되게 조절
      }
    }
    setTimeout(type, 500);
  }

  // Interactive Graphic Card Hover effect
  const card = document.querySelector('.hero-preview-card');
  if (card) {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      card.style.transform = `perspective(1000px) rotateY(${x * 0.03}deg) rotateX(${-y * 0.03}deg) translateY(-5px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0)';
    });
  }
}
